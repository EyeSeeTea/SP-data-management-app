import { getMockApi } from "d2-api";
import _ from "lodash";
import { ProjectData } from "./../Project";
import Project from "../Project";
import { Config } from "../Config";
import configJson from "./config.json";

const { api, mock } = getMockApi();
const config = (configJson as unknown) as Config;

function getProject() {
    return Project.create(api, config).set("id", "BvNo8zQaol8");
}

async function expectFieldPresence(field: keyof ProjectData) {
    const project = await getProject();
    const errors = await project.validate([field]);
    expect(errors[field] !== undefined && (errors[field] || []).length > 0).toBeTruthy();
}

describe("Project", () => {
    describe("set", () => {
        it("sets immutable data fields using field name", async () => {
            const project1 = await getProject();
            const project2 = project1.set("name", "Project name");
            expect(project1.name).toEqual("");
            expect(project2.name).toEqual("Project name");
        });
    });

    describe("create", () => {});

    describe("get", () => {});

    describe("code", () => {
        it("joins {subsequentLettering}{this.awardNumber}-{this.speedKey}", async () => {
            const project = await getProject();
            const project2 = project.setObj({
                subsequentLettering: "es",
                awardNumber: "12345",
                speedKey: "somekey",
            });
            expect(project2.code).toEqual("es12345-somekey");
        });

        it("joins {subsequentLettering}{this.awardNumber} if speedKey not set", async () => {
            const project = await getProject();
            const project2 = project.set("subsequentLettering", "es").set("awardNumber", "12345");
            expect(project2.code).toEqual("es12345");
        });
    });

    describe("getOrganisationUnitsWithName", () => {
        const paginatedOrgUnits = {
            pager: { page: 1, pageSize: 10, pageCount: 1, total: 0 },
            organisationUnits: [{ id: "1", displayName: "Asia" }],
        };

        beforeEach(() => {
            mock.onGet("/organisationUnits", {
                params: {
                    fields: "displayName,id",
                    filter: ["id:eq:1"],
                },
            }).replyOnce(200, paginatedOrgUnits);
        });
    });

    describe("validate", () => {
        it("requires a name", async () => {
            expectFieldPresence("name");
        });

        it("requires a start date", async () => {
            expectFieldPresence("startDate");
        });

        it("requires a end date", async () => {
            expectFieldPresence("endDate");
        });

        it("limits speedKey to 40 chars", async () => {
            const project = (await getProject()).set("speedKey", "1");
            const errors = await project.validate(["speedKey"]);
            expect(errors["speedKey"]).toHaveLength(0);

            const project2 = project.set("speedKey", _.repeat("1", 41));
            const errors2 = await project2.validate(["speedKey"]);
            expect(errors2["speedKey"]).toHaveLength(1);
            expect(errors2["speedKey"]).toContain("Speed Key must be less than or equal to 40");
        });

        it("requires a five-digit string in award number", async () => {
            const project = (await getProject()).set("awardNumber", "12345");
            const errors = await project.validate(["awardNumber"]);
            expect(errors["awardNumber"]).toHaveLength(0);

            const project2 = project.set("awardNumber", "12");
            const errors2 = await project2.validate(["awardNumber"]);
            expect(errors2["awardNumber"]).toHaveLength(1);
            expect(errors2["awardNumber"]).toContain("Award Number should be a number of 5 digits");

            const project3 = project.set("awardNumber", "123456");
            const errors3 = await project3.validate(["awardNumber"]);
            expect(errors3["awardNumber"]).toHaveLength(1);
            expect(errors3["awardNumber"]).toContain("Award Number should be a number of 5 digits");
        });

        it("requires a string of two letters in subsequent lettering", async () => {
            const project = (await getProject()).set("subsequentLettering", "NG");
            const errors = await project.validate(["subsequentLettering"]);
            expect(errors["subsequentLettering"]).toHaveLength(0);

            const project2 = project.set("subsequentLettering", "N");
            const errors2 = await project2.validate(["subsequentLettering"]);
            expect(errors2["subsequentLettering"]).toHaveLength(1);
            expect(errors2["subsequentLettering"]).toContain(
                "Subsequent Lettering must be a string of two letters only"
            );

            const project3 = project.set("subsequentLettering", "NGO");
            const errors3 = await project3.validate(["subsequentLettering"]);
            expect(errors3["subsequentLettering"]).toHaveLength(1);
            expect(errors3["subsequentLettering"]).toContain(
                "Subsequent Lettering must be a string of two letters only"
            );
        });

        it("requires at least one sector", async () => {
            expectFieldPresence("sectors");
        });

        it("requires at least one funder", async () => {
            expectFieldPresence("funders");
        });

        it("requires one organisation unit", async () => {
            expectFieldPresence("parentOrgUnit");
        });

        it("requires a unique code", async () => {
            const project = (await getProject()).setObj({
                subsequentLettering: "au",
                awardNumber: "19234",
                speedKey: "key",
            });

            mock.onGet("/metadata", {
                params: {
                    "organisationUnits:fields": "displayName",
                    "organisationUnits:filter": ["code:eq:au19234-key", "id:ne:BvNo8zQaol8"],
                },
            }).replyOnce(200, { organisationUnits: [{ displayName: "Asia" }] });

            const errors = await project.validate(["code"]);
            expect(errors.code).toEqual([
                "There is a project with the same code 'au19234-key' -> Asia",
            ]);
        });

        it("requires at least one data element by sector", async () => {
            const project = (await getProject()).setObj({
                sectors: [
                    { id: "mGQ5ckOTU8A", displayName: "Agriculture", code: "SECTOR_AGRICULTURE" },
                    { id: "m4Cg6FOPPR7", displayName: "Livelihoods", code: "SECTOR_LIVELIHOODS" },
                ],
            });
            const errors = await project.validate(["dataElements"]);
            expect(errors.dataElements).toEqual([
                "The following sectors have no indicators selected: Agriculture, Livelihoods",
            ]);

            const { project: project2 } = project.updateDataElementsSelection(["qQy0N1xdwQ1"]);
            const errors2 = await project2.validate(["dataElements"]);
            expect(errors2.dataElements).toEqual([
                "The following sectors have no indicators selected: Livelihoods",
            ]);

            const { project: project3 } = project2.updateDataElementsSelection([
                "qQy0N1xdwQ1",
                "iyQBe9Xv7bk",
            ]);
            const errors3 = await project3.validate(["dataElements"]);
            expect(errors3.dataElements).toEqual([]);
        });

        it("without keys, it runs all validations", async () => {
            const project = await getProject();
            const errors = await project.validate();
            expect(_.keys(errors)).toEqual(
                expect.arrayContaining([
                    "name",
                    "startDate",
                    "endDate",
                    "awardNumber",
                    "subsequentLettering",
                    "speedKey",
                    "sectors",
                    "funders",
                    "parentOrgUnit",
                    "dataElements",
                ])
            );
        });
    });

    describe("getList", () => {
        const objectsPaginated = {
            pager: {
                page: 1,
                pageCount: 3,
                total: 12,
                pageSize: 5,
            },
            organisationUnits: [{ id: "1234a" }, { id: "1234b" }],
        };

        const baseRequest = {
            paging: true,
            fields:
                "closedDate,code,created,displayDescription,displayName,href,id,lastUpdated,lastUpdatedBy[name],openingDate,publicAccess,user[displayName,id]",
            order: "displayName:iasc",
            page: 1,
            pageSize: 10,
            filter: ["level:eq:3"],
        };

        it("returns list of organisation units of level 3", async () => {
            mock.onGet("/organisationUnits", {
                params: baseRequest,
            }).replyOnce(200, objectsPaginated);

            const { objects, pager } = await Project.getList(
                api,
                config,
                {},
                { page: 1, pageSize: 10, sorting: ["displayName", "asc"] }
            );

            expect(pager).toEqual(objectsPaginated.pager);
            expect(objects).toEqual(objectsPaginated.organisationUnits);
        });

        it("returns list of organisation units filtered", async () => {
            mock.onGet("/organisationUnits", {
                params: {
                    ...baseRequest,
                    filter: ["level:eq:3", "name:ilike:abc", "user.id:eq:M5zQapPyTZI"],
                },
            }).replyOnce(200, objectsPaginated);

            const { objects, pager } = await Project.getList(
                api,
                config,
                { search: "abc", createdByCurrentUser: true },
                { page: 1, pageSize: 10, sorting: ["displayName", "asc"] }
            );

            expect(pager).toEqual(objectsPaginated.pager);
            expect(objects).toEqual(objectsPaginated.organisationUnits);
        });
    });
});

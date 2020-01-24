import { getMockApi } from "d2-api";
import _ from "lodash";
import { ProjectData } from "./../Project";
import Project from "../Project";
import { Config } from "../Config";
import configJson from "./config.json";
import moment from "moment";

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

    describe("create", () => {
        let project: Project;

        beforeEach(() => {
            project = Project.create(api, config);
        });

        it("has a valid UID", () => {
            expect(project.id).toHaveLength(11);
            expect(project.id).toMatch(/^[a-zA-Z][a-zA-Z0-9]{10}$/);
        });

        it("has empty values", () => {
            expect(project.name).toEqual("");
            expect(project.description).toEqual("");
            expect(project.awardNumber).toEqual("");
            expect(project.subsequentLettering).toEqual("");
            expect(project.speedKey).toEqual("");
            expect(project.startDate).toEqual(undefined);
            expect(project.endDate).toEqual(undefined);
            expect(project.sectors).toEqual([]);
            expect(project.funders).toEqual([]);
            expect(project.locations).toEqual([]);
            expect(project.orgUnit).toEqual(undefined);
            expect(project.parentOrgUnit).toEqual(undefined);
            expect(project.dataSets).toEqual(undefined);
            expect(project.dashboard).toEqual(undefined);
            expect(project.initialData).toEqual(undefined);
        });

        it("has data element sets", () => {
            expect(project.dataElements.get().length).toBeGreaterThan(0);
        });
    });

    describe("get", () => {
        let project: Project;

        beforeAll(async () => {
            mock.onGet("/metadata", {
                params: {
                    "organisationUnits:fields":
                        "attributeValues[attribute[id],value],closedDate,code,description,displayName,id,name,openingDate,organisationUnitGroups[id],parent[displayName,id,path],path",
                    "organisationUnits:filter": ["id:eq:R3rGhxWbAI9"],
                    "dataSets:fields":
                        "code,dataInputPeriods[closingDate,openingDate,period],dataSetElements[categoryCombo[id],dataElement[id]],id,sections[code]",
                    "dataSets:filter": ["code:$like:R3rGhxWbAI9"],
                },
            }).replyOnce(200, metadataForGet);

            mock.onGet("/dataStore/project-monitoring-app/mer-R3rGhxWbAI9").replyOnce(200, {
                dataElements: ["u24zk6wAgFE"],
            });

            project = await Project.get(api, config, "R3rGhxWbAI9");
        });

        it("has filled values", () => {
            expect(project.id).toEqual("R3rGhxWbAI9");
            expect(project.name).toEqual("0Test1-13726c");
            expect(project.description).toEqual("Some description2");
            expect(project.awardNumber).toEqual("34549");
            expect(project.subsequentLettering).toEqual("fr");
            expect(project.speedKey).toEqual("");
            expect(project.startDate && project.startDate.format("L")).toEqual(
                moment("2020-01-01").format("L")
            );
            expect(project.endDate && project.endDate.format("L")).toEqual(
                moment("2020-03-31").format("L")
            );
            expect(project.sectors.map(sector => sector.code)).toEqual(["SECTOR_LIVELIHOOD"]);
            expect(project.funders.map(funder => funder.displayName)).toEqual([
                "2018 World Food Program",
                "ACWME",
            ]);
            expect(project.locations.map(location => location.displayName)).toEqual(["Abaco"]);
            expect(project.orgUnit && project.orgUnit.id).toEqual("R3rGhxWbAI9");
            expect(project.parentOrgUnit && project.parentOrgUnit.id).toEqual("eu2XF73JOzl");
            expect(project.dataSets && project.dataSets.actual.code).toEqual("R3rGhxWbAI9_ACTUAL");
            expect(project.dashboard).toEqual({ id: "yk6HaCRtmEL" });
        });

        it("has initial data set", () => {
            expect(project.initialData && project.initialData.id).toEqual("R3rGhxWbAI9");
        });

        it("has data element sets", () => {
            expect(project.dataElements.get({ onlySelected: true }).map(de => de.id)).toEqual([
                "u24zk6wAgFE",
                "yMqK9DKbA3X",
            ]);
            expect(project.dataElements.get({ onlyMERSelected: true }).map(de => de.id)).toEqual([
                "u24zk6wAgFE",
            ]);
        });

        it("raises exception on not found", async () => {
            mock.onGet("/metadata").replyOnce(200, {});
            await expect(Project.get(api, config, "a1234567890")).rejects.toThrow();
        });
    });

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
                    { id: "GkiSljtLcOI", displayName: "Livelihood", code: "SECTOR_LIVELIHOOD" },
                ],
            });
            const errors = await project.validate(["dataElements"]);
            expect(errors.dataElements).toEqual([
                "The following sectors have no indicators selected: Agriculture, Livelihood",
            ]);

            const { project: project2 } = project.updateDataElementsSelection(["qQy0N1xdwQ1"]);
            const errors2 = await project2.validate(["dataElements"]);
            expect(errors2.dataElements).toEqual([
                "The following sectors have no indicators selected: Livelihood",
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
            organisationUnits: [
                { id: "1234a", parent: { id: "parent1" } },
                { id: "1234b", parent: { id: "parent2" } },
            ],
        };

        const baseRequest = {
            paging: true,
            fields:
                "closedDate,code,created,displayDescription,displayName,href,id,lastUpdated,lastUpdatedBy[name],openingDate,parent[displayName,id],publicAccess,user[displayName,id]",
            order: "displayName:iasc",
            page: 1,
            pageSize: 10,
            filter: ["level:eq:3"],
        };

        it.only("returns list of organisation units filtered", async () => {
            mock.onGet("/organisationUnits", {
                params: {
                    ...baseRequest,
                    filter: [
                        "level:eq:3",
                        "name:ilike:abc",
                        "parent.id:in:[parent1]",
                        "user.id:eq:M5zQapPyTZI",
                    ],
                },
            }).replyOnce(200, objectsPaginated);

            mock.onGet("/metadata", {
                params: {
                    "dataSets:fields": "code,sections[code]",
                    "dataSets:filter": ["code:in:[1234a_ACTUAL,1234b_ACTUAL]"],
                },
            }).replyOnce(200, {});

            const { objects, pagination } = await Project.getList(
                api,
                config,
                { search: "abc", createdByCurrentUser: true, countryIds: ["parent1"] },
                { field: "displayName", order: "asc" },
                { page: 1, pageSize: 10 }
            );

            expect(pagination).toEqual(objectsPaginated.pager);
            expect(objects).toEqual([
                { id: "1234a", parent: { id: "parent1" }, sectors: [] },
                { id: "1234b", parent: { id: "parent2" }, sectors: [] },
            ]);
        });
    });
});

const metadataForGet = {
    organisationUnits: [
        {
            code: "fr34549",
            name: "0Test1-13726c",
            id: "R3rGhxWbAI9",
            path: "/J0hschZVMBt/eu2XF73JOzl/R3rGhxWbAI9",
            closedDate: "2020-04-30T00:00:00.000",
            displayName: "0Test1-13726c",
            description: "Some description2",
            openingDate: "2019-12-01T00:00:00.000",
            parent: {
                id: "eu2XF73JOzl",
                path: "/J0hschZVMBt/eu2XF73JOzl",
                displayName: "Bahamas",
            },
            attributeValues: [
                {
                    value: "true",
                    attribute: {
                        id: "mgCKcJuP5n0",
                    },
                },
                {
                    value: "yk6HaCRtmEL",
                    attribute: {
                        id: "aywduilEjPQ",
                    },
                },
            ],
            organisationUnitGroups: [
                {
                    id: "WKUXmz4LIUG",
                },
                {
                    id: "OE0KdZRX2FC",
                },
                {
                    id: "GG0k0oNhgS7",
                },
            ],
        },
    ],
    dataSets: [
        {
            code: "R3rGhxWbAI9_ACTUAL",
            id: "imYbEtdoQZx",
            dataSetElements: [
                {
                    categoryCombo: {
                        id: "bjDvmb4bfuf",
                    },
                    dataElement: {
                        id: "u24zk6wAgFE",
                    },
                },
                {
                    categoryCombo: {
                        id: "bjDvmb4bfuf",
                    },
                    dataElement: {
                        id: "yMqK9DKbA3X",
                    },
                },
            ],
            dataInputPeriods: [
                {
                    closingDate: "2020-03-10T00:00:00.000",
                    openingDate: "2020-02-01T00:00:00.000",
                    period: {
                        id: "202002",
                    },
                },
                {
                    closingDate: "2020-04-10T00:00:00.000",
                    openingDate: "2020-03-01T00:00:00.000",
                    period: {
                        id: "202003",
                    },
                },
                {
                    closingDate: "2020-02-10T00:00:00.000",
                    openingDate: "2020-01-01T00:00:00.000",
                    period: {
                        id: "202001",
                    },
                },
            ],
            sections: [
                {
                    code: "SECTOR_LIVELIHOOD_imYbEtdoQZx",
                },
            ],
        },
        {
            code: "R3rGhxWbAI9_TARGET",
            id: "KC6gi00Jm6H",
            dataSetElements: [
                {
                    categoryCombo: {
                        id: "bjDvmb4bfuf",
                    },
                    dataElement: {
                        id: "yMqK9DKbA3X",
                    },
                },
                {
                    categoryCombo: {
                        id: "bjDvmb4bfuf",
                    },
                    dataElement: {
                        id: "u24zk6wAgFE",
                    },
                },
            ],
            dataInputPeriods: [
                {
                    closingDate: "2020-02-01T00:00:00.000",
                    openingDate: "2020-01-01T00:00:00.000",
                    period: {
                        id: "202001",
                    },
                },
                {
                    closingDate: "2020-02-01T00:00:00.000",
                    openingDate: "2020-01-01T00:00:00.000",
                    period: {
                        id: "202003",
                    },
                },
                {
                    closingDate: "2020-02-01T00:00:00.000",
                    openingDate: "2020-01-01T00:00:00.000",
                    period: {
                        id: "202002",
                    },
                },
            ],
            sections: [
                {
                    code: "SECTOR_LIVELIHOOD_KC6gi00Jm6H",
                },
            ],
        },
    ],
};

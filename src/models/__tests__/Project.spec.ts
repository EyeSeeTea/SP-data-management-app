import { getMockApi } from "../../types/d2-api";
import _ from "lodash";
import { ValidationKey } from "./../Project";
import Project from "../Project";
import { Config } from "../Config";
import configJson from "./config.json";
import moment from "moment";
import { logUnknownRequest } from "../../utils/tests";

const { api, mock } = getMockApi();
const config = configJson as unknown as Config;

function getNewProject() {
    return Project.create(api, config).set("id", "BvNo8zQaol8");
}

async function expectFieldPresence(field: ValidationKey) {
    const project = await getNewProject();
    const errors = await project.validate([field]);
    expect(errors[field] !== undefined && (errors[field] || []).length > 0).toBeTruthy();
}

const metadataAccess = {
    read: true,
    update: true,
    externalize: false,
    delete: true,
    write: true,
    manage: true,
    data: { read: false, write: true },
};

const fullAccess = {
    ...metadataAccess,
    data: { read: true, write: true },
};

describe("Project", () => {
    describe("set", () => {
        it("sets immutable data fields using field name", async () => {
            const project1 = await getNewProject();
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
            expect(project.created).toEqual(undefined);
            expect(project.description).toEqual("");
            expect(project.awardNumber).toEqual("");
            expect(project.subsequentLettering).toEqual("");
            expect(project.additional).toEqual("");
            expect(project.startDate).toEqual(undefined);
            expect(project.endDate).toEqual(undefined);
            expect(project.sectors).toEqual([]);
            expect(project.funders).toEqual([]);
            expect(project.locations).toEqual([]);
            expect(project.orgUnit).toEqual(undefined);
            expect(project.parentOrgUnit).toEqual(undefined);
            expect(project.dataSets).toEqual(undefined);
            expect(project.dashboard).toEqual({});
            expect(project.initialData).toEqual(undefined);
        });

        it("has data element sets", () => {
            expect(project.dataElementsSelection.get().length).toBeGreaterThan(0);
        });
    });

    describe("get", () => {
        it("has filled values", async () => {
            const project = await getProject();

            expect(project.id).toEqual("R3rGhxWbAI9");
            expect(project.name).toEqual("0Test1-13726c");
            expect(project.description).toEqual("Some description2");
            expect(project.awardNumber).toEqual("34549");
            expect(project.subsequentLettering).toEqual("fr");
            expect(project.additional).toEqual("");
            expect(project.startDate && project.startDate.format("L")).toEqual(
                moment("2020-01-01").format("L")
            );
            expect(project.endDate && project.endDate.format("L")).toEqual(
                moment("2020-03-31").format("L")
            );
            expect(project.sectors.map(sector => sector.code)).toEqual(["SECTOR_LIVELIHOODS"]);
            expect(project.funders.map(funder => funder.displayName)).toEqual([]);
            expect(project.locations.map(location => location.displayName)).toEqual([
                "loc-GG0k0oNhgS7",
            ]);
            expect(project.orgUnit && project.orgUnit.id).toEqual("R3rGhxWbAI9");
            expect(project.parentOrgUnit && project.parentOrgUnit.id).toEqual("eu2XF73JOzl");
            expect(project.dataSets && project.dataSets.actual.code).toEqual("R3rGhxWbAI9_ACTUAL");
            expect(project.dashboard).toEqual({
                project: { id: "yk6HaCRtmEL", name: "dashboard-yk6HaCRtmEL" },
            });
        });

        it("has initial data set", async () => {
            const project = await getProject();
            expect(project.initialData && project.initialData.id).toEqual("R3rGhxWbAI9");
        });

        it("has data element sets", async () => {
            const project = await getProject();
            expect(
                project.dataElementsSelection.get({ onlySelected: true }).map(de => de.id)
            ).toEqual(["yMqK9DKbA3X", "u24zk6wAgFE"]);
            expect(project.dataElementsMER.get({ onlySelected: true }).map(de => de.id)).toEqual([
                "u24zk6wAgFE",
            ]);
        });

        it("raises exception on not found", async () => {
            mock.reset();
            mock.onGet("/metadata").replyOnce(200, {});
            await expect(Project.get(api, config, "a1234567890")).rejects.toThrow();
        });
    });

    describe("code", () => {
        it("joins {subsequentLettering}{this.awardNumber}-{this.additional}", async () => {
            const project = await getNewProject();
            const project2 = project.setObj({
                subsequentLettering: "es",
                awardNumber: "12345",
                additional: "some-key",
            });
            expect(project2.code).toEqual("12345es-some-key");
        });

        it("joins {subsequentLettering}{this.awardNumber} if additional not set", async () => {
            const project = await getNewProject();
            const project2 = project.set("subsequentLettering", "es").set("awardNumber", "12345");
            expect(project2.code).toEqual("12345es");
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

        it("requires a end date after the start date", async () => {
            const project = (await getNewProject())
                .set("startDate", moment(moment([2020, 1, 2])))
                .set("endDate", moment([2020, 1, 1]));
            const errors = await project.validate();
            expect(errors).toHaveProperty("endDateAfterStartDate");
        });

        it("limits additional designation to 40 chars", async () => {
            const project = (await getNewProject()).set("additional", "1");
            const errors = await project.validate(["additional"]);
            expect(errors["additional"]).toHaveLength(0);

            const project2 = project.set("additional", _.repeat("1", 41));
            const errors2 = await project2.validate(["additional"]);
            expect(errors2["additional"]).toHaveLength(1);
            expect(errors2["additional"]).toContain(
                "Additional Designation (Funder, Location, Sector, etc) must be less than or equal to 40"
            );
        });

        it("requires a five-digit string in award number", async () => {
            const project = (await getNewProject()).set("awardNumber", "12345");
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
            const project = (await getNewProject()).set("subsequentLettering", "NG");
            const errors = await project.validate(["subsequentLettering"]);
            expect(errors["subsequentLettering"]).toHaveLength(0);

            const project2 = project.set("subsequentLettering", "N");
            const errors2 = await project2.validate(["subsequentLettering"]);
            expect(errors2["subsequentLettering"]).toHaveLength(1);
            expect(errors2["subsequentLettering"]).toContain(
                "Subsequent Lettering must contain exactly two letters"
            );

            const project3 = project.set("subsequentLettering", "NGO");
            const errors3 = await project3.validate(["subsequentLettering"]);
            expect(errors3["subsequentLettering"]).toHaveLength(1);
            expect(errors3["subsequentLettering"]).toContain(
                "Subsequent Lettering must contain exactly two letters"
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
            const project = (await getNewProject()).setObj({
                subsequentLettering: "au",
                awardNumber: "19234",
                additional: "key",
            });

            mock.reset();

            mock.onGet("/metadata", {
                params: {
                    "organisationUnits:fields": "displayName",
                    "organisationUnits:filter": ["code:eq:19234au-key", "id:ne:BvNo8zQaol8"],
                },
            }).replyOnce(200, { organisationUnits: [{ displayName: "Asia" }] });

            const errors = await project.validate(["code"]);
            expect(errors.code).toEqual([
                "There is a project with the same code '19234au-key' -> Asia",
            ]);
        });

        it("requires at least one data element by sector", async () => {
            const project = (await getNewProject()).setObj({
                sectors: [
                    { id: "ieyBABjYyHO", displayName: "Agriculture", code: "SECTOR_AGRICULTURE" },
                    { id: "GkiSljtLcOI", displayName: "Livelihoods", code: "SECTOR_LIVELIHOODS" },
                ],
            });
            const errors = await project.validate(["dataElementsSelection"]);
            expect(errors.dataElementsSelection).toEqual([
                "The following sectors have no indicators selected: Agriculture, Livelihoods",
            ]);

            const { project: project2 } = project.updateDataElementsSelection("ieyBABjYyHO", [
                "qQy0N1xdwQ1",
            ]);
            const errors2 = await project2.validate(["dataElementsSelection"]);
            expect(errors2.dataElementsSelection).toEqual([
                "The following sectors have no indicators selected: Livelihoods",
            ]);

            const { project: project3 } = project2
                .updateDataElementsSelection("ieyBABjYyHO", ["qQy0N1xdwQ1"])
                .project.updateDataElementsSelection("GkiSljtLcOI", ["iyQBe9Xv7bk"]);
            const errors3 = await project3.validate(["dataElementsSelection"]);
            expect(errors3.dataElementsSelection).toEqual([]);
        });

        it("without keys, it runs all validations", async () => {
            const project = await getNewProject();
            const errors = await project.validate();
            expect(_.keys(errors)).toEqual(
                expect.arrayContaining([
                    "name",
                    "startDate",
                    "endDate",
                    "awardNumber",
                    "subsequentLettering",
                    "additional",
                    "sectors",
                    "funders",
                    "parentOrgUnit",
                    "dataElementsSelection",
                    "dataElementsMER",
                ])
            );
        });
    });

    describe("getList", () => {
        const createdByApp = { attribute: { id: "mgCKcJuP5n0" }, value: "true" };
        const organisationUnitsUnpaginated = [
            { i: "1", c: "code1", n: "name1", attributeValues: [createdByApp] },
            { i: "2", c: "other2", n: "other2", attributeValues: [createdByApp] },
            { i: "3", c: "CODE3", n: "name3", attributeValues: [createdByApp] },
            { i: "4", c: "other4", n: "other4", attributeValues: [createdByApp] },
            { i: "5", c: "code5", n: "NAME5", attributeValues: [createdByApp] },
            { i: "6", c: "code6", n: "NAME6", attributeValues: [] },
        ];

        const organisationUnits = [
            {
                id: "1",
                code: "code1",
                name: "name1",
                displayName: "name1",
                organisationUnitGroups: [],
                attributeValues: [],
            },
            {
                id: "2",
                code: "other2",
                name: "other2",
                displayName: "other2",
                organisationUnitGroups: [],
                attributeValues: [],
            },
            {
                id: "3",
                code: "CODE3",
                name: "name3",
                displayName: "name3",
                organisationUnitGroups: [],
                attributeValues: [],
            },
            {
                id: "4",
                code: "other4",
                name: "other4",
                displayName: "other4",
                organisationUnitGroups: [],
                attributeValues: [],
            },
            {
                id: "5",
                code: "code5",
                name: "NAME5",
                displayName: "NAME5",
                organisationUnitGroups: [],
                attributeValues: [],
            },
            {
                id: "6",
                code: "code6",
                name: "NAME6",
                displayName: "NAME6",
                organisationUnitGroups: [],
                attributeValues: [],
            },
        ];

        const orgUnitsById = _.keyBy(organisationUnits, ou => ou.id);

        it("returns list of organisation units filtered", async () => {
            mock.onGet("/organisationUnits", {
                params: {
                    paging: false,
                    fields: "attributeValues[attribute[id],value],code~rename(c),displayName~rename(n),id~rename(i)",
                    order: "displayName:idesc",
                    filter: [
                        "attributeValues.attribute.id:eq:mgCKcJuP5n0",
                        "level:eq:3",
                        "parent.id:in:[parent1]",
                        "user.id:eq:M5zQapPyTZI",
                    ],
                },
            }).replyOnce(200, { organisationUnits: _.reverse(organisationUnitsUnpaginated) });

            mock.onGet("/organisationUnits", {
                params: {
                    paging: false,
                    fields: "attributeValues[attribute[id],value],closedDate,code,created,displayDescription,displayName,href,id,lastUpdated,lastUpdatedBy[name],name,openingDate,organisationUnitGroups[groupSets[id],id],parent[displayName,id],user[displayName,id]",
                    filter: ["id:in:[5,3,1]"],
                    order: "displayName:idesc",
                },
            }).replyOnce(200, { organisationUnits: _.at(orgUnitsById, ["5", "3"]) });

            mock.onGet("/metadata", {
                params: {
                    "dataSets:fields":
                        "access,attributeValues[attribute[id],value],code,sections[code],userAccesses[access,displayName,id],userGroupAccesses[access,displayName,id]",
                    "dataSets:filter": ["code:like$:_ACTUAL"],
                    "organisationUnitGroupSets:fields":
                        "id,organisationUnitGroups[id,organisationUnits[id]]",
                    "organisationUnitGroupSets:filter": ["id:eq:OUGGW1cHaYy"],
                },
            }).replyOnce(200, {
                dataSets: [
                    {
                        id: "ds3",
                        code: "3_ACTUAL",
                        sections: [
                            { code: "SECTOR_AGRICULTURE_ds3", dataElements: [{ id: "de1" }] },
                        ],
                        access: fullAccess,
                        attributeValues: [],
                    },
                    {
                        id: "ds5",
                        code: "5_ACTUAL",
                        sections: [
                            { code: "SECTOR_AGRICULTURE_ds5", dataElements: [{ id: "de2" }] },
                        ],
                        access: metadataAccess,
                        attributeValues: [],
                    },
                ],
            });

            logUnknownRequest(mock);

            const { objects, pager: pagination } = await Project.getList(
                api,
                config,
                {
                    search: "name",
                    createdByCurrentUser: true,
                    countryIds: ["parent1"],
                    createdByAppOnly: true,
                },
                { field: "displayName", order: "desc" },
                { page: 1, pageSize: 2 }
            );

            expect(pagination).toEqual({ page: 1, pageSize: 2, total: 1, pageCount: 1 });
            const emptySharing = { userAccesses: [], userGroupAccesses: [] };
            expect(objects).toMatchObject([
                {
                    id: "3",
                    code: "CODE3",
                    name: "name3",
                    displayName: "name3",
                    hasAwardNumberDashboard: false,
                    sectors: expect.arrayContaining([
                        expect.objectContaining({ code: "SECTOR_AGRICULTURE" }),
                    ]),
                    sharing: emptySharing,
                },
            ]);
        });
    });
});

const metadataForGet = {
    organisationUnits: [
        {
            code: "34549fr",
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
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [],
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
                    code: "SECTOR_LIVELIHOODS_imYbEtdoQZx",
                    dataElements: [{ id: "u24zk6wAgFE" }, { id: "yMqK9DKbA3X" }],
                },
            ],
        },
        {
            code: "R3rGhxWbAI9_TARGET",
            id: "KC6gi00Jm6H",
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [],
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
                    code: "SECTOR_LIVELIHOODS_KC6gi00Jm6H",
                    dataElements: [{ id: "5678" }],
                },
            ],
        },
    ],
};

async function getProject(): Promise<Project> {
    mock.reset();

    mock.onGet("/metadata", {
        params: {
            "organisationUnits:fields":
                "attributeValues[attribute[id],value],closedDate,code,created,description,displayName,id,name,openingDate,organisationUnitGroups[attributeValues[attribute[id],value],groupSets[id],id,name],parent[attributeValues[attribute[id],value],displayName,id,name,path],path",
            "organisationUnits:filter": ["id:eq:R3rGhxWbAI9"],
            "dataSets:fields":
                "code,dataInputPeriods[closingDate,openingDate,period],dataSetElements[categoryCombo[categoryOptionCombos[id],id],dataElement[id]],expiryDays,externalAccess,id,openFuturePeriods,publicAccess,sections[code,dataElements[id]],userAccesses[access,displayName,id],userGroupAccesses[access,displayName,id]",
            "dataSets:filter": ["code:$like:R3rGhxWbAI9"],
        },
    }).replyOnce(200, metadataForGet);

    mock.onGet("/dashboards", {
        params: { fields: "id,name", filter: ["id:in:[yk6HaCRtmEL]"] },
    }).replyOnce(200, { dashboards: [{ id: "yk6HaCRtmEL", name: "dashboard-yk6HaCRtmEL" }] });

    mock.onGet("/documents", {
        params: { fields: "id,name,url", filter: ["id:in:[]"] },
    }).replyOnce(200, { documents: [] });

    mock.onGet("/dataStore/data-management-app/project-R3rGhxWbAI9").replyOnce(200, {
        merDataElementIds: ["u24zk6wAgFE"],
    });

    logUnknownRequest(mock);

    return Project.get(api, config, "R3rGhxWbAI9");
}

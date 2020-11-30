import { getMockApi } from "../../types/d2-api";
import ProjectDb from "../ProjectDb";
import { getProject } from "./project-data";
import { logUnknownRequest } from "../../utils/tests";
import expectedMetadataPost from "./data/project-db-metadata.json";
import projectMetadataResponse from "./data/project-metadata.json";
import countryMetadataResponse from "./data/country-metadata.json";

const { api, mock } = getMockApi();

const metadataResponse = {
    status: "OK",
    stats: { created: 0, updated: 0, deleted: 0, ignored: 0, total: 0 },
};

describe("ProjectDb", () => {
    describe("save", () => {
        it("posts metadata", async () => {
            const project = await getProject(api, { orgUnit: undefined });

            // Validation
            mock.onGet("/metadata", {
                params: {
                    "organisationUnits:fields": "displayName",
                    "organisationUnits:filter": ["code:eq:12345en", "id:ne:WGC0DJ0YSis"],
                },
            }).replyOnce(200, []);

            // Project dashboard

            mock.onGet("/metadata", {
                params: {
                    "organisationUnits:fields": "children[id,name,parent],id,name,parent,path",
                    "organisationUnits:filter": ["id:eq:WGC0DJ0YSis"],
                    "dataSets:fields":
                        "code,dataInputPeriods[period[id]],dataSetElements[dataElement[attributeValues[attribute[id],value],code,dataElementGroups[code],id,name]],externalAccess,id,publicAccess,userAccesses[access,displayName,id],userGroupAccesses[access,displayName,id]",
                    "dataSets:filter": [
                        "code:like$:_ACTUAL",
                        "organisationUnits.path:like:WGC0DJ0YSis",
                    ],
                },
            }).replyOnce(200, projectMetadataResponse);

            // Country dashboard

            mock.onGet("/metadata", {
                params: {
                    "organisationUnits:fields": "children[id,name,parent],id,name,parent,path",
                    "organisationUnits:filter": ["id:eq:eu2XF73JOzl"],
                    "dataSets:fields":
                        "code,dataInputPeriods[period[id]],dataSetElements[dataElement[attributeValues[attribute[id],value],code,dataElementGroups[code],id,name]],externalAccess,id,publicAccess,userAccesses[access,displayName,id],userGroupAccesses[access,displayName,id]",
                    "dataSets:filter": [
                        "code:like$:_ACTUAL",
                        "organisationUnits.path:like:eu2XF73JOzl",
                    ],
                },
            }).replyOnce(200, countryMetadataResponse);

            mock.onGet("/metadata", {
                params: {
                    "organisationUnits:fields":
                        ":owner,attributeValues[attribute[id],value],children[id,name]",
                    "organisationUnits:filter": ["id:eq:eu2XF73JOzl"],
                },
            }).replyOnce(200, { organisationUnits: countryMetadataResponse.organisationUnits });

            mock.onGet("/metadata", {
                params: {
                    "organisationUnits:fields": "children[id,name],id,name",
                    "organisationUnits:filter": ["id:eq:eu2XF73JOzl"],
                },
            }).replyOnce(200, { organisationUnits: countryMetadataResponse.organisationUnits });

            mock.onGet("/metadata", {
                params: {
                    "organisationUnitGroups:fields": ":owner",
                    "organisationUnitGroups:filter": ["organisationUnits.id:eq:WGC0DJ0YSis"],
                    "organisationUnitGroupSets:fields": ":owner",
                    "organisationUnitGroupSets:filter": ["code:eq:AWARD_NUMBER"],
                },
            }).replyOnce(200, {
                organisationUnitGroupSets: [
                    {
                        id: "OUGGW1cHaYy",
                        name: "Award number",
                        code: "AWARD_NUMBER",
                        organisationUnitGroups: [{ id: "existing-1234" }],
                    },
                ],
            });

            mock.onGet("/metadata", {
                params: {
                    "organisationUnits:fields": ":owner",
                    "organisationUnits:filter": ["id:eq:eu2XF73JOzl"],
                },
            }).replyOnce(200, {
                organisationUnits: [{ id: "eu2XF73JOzl", name: "Bahamas", attributeValues: [] }],
            });

            mock.onGet("/metadata", {
                params: {
                    "organisationUnitGroups:fields": ":owner",
                    "organisationUnitGroups:filter": [
                        "id:in:[OE0KdZRX2FC,WKUXmz4LIUG,GG0k0oNhgS7,WIEp6vpQw6n]",
                    ],
                },
            }).replyOnce(200, orgUnitsMetadata);

            mock.onPost("/metadata", expectedMetadataPost).replyOnce(200, metadataResponse);

            mock.onPost("/metadata", expectedSectionsMetadataPost).replyOnce(200, metadataResponse);

            mock.onPut("/organisationUnits/WGC0DJ0YSis", expectedOrgUnitPut).replyOnce(200);

            mock.onPut(
                "/dataStore/data-management-app/project-WGC0DJ0YSis",
                expectedDataStoreMer
            ).replyOnce(200);

            logUnknownRequest(mock);

            jest.spyOn(Date, "now").mockReturnValueOnce(new Date("2019/12/15").getTime());

            const { response, project: savedProject } = await new ProjectDb(project).save();
            expect(response && response.status).toEqual("OK");
            expect(savedProject.id).toEqual("WGC0DJ0YSis");
        });
    });
});

const orgUnitsMetadata = {
    organisationUnitGroups: [
        {
            created: "2020-01-02T12:32:30.449",
            lastUpdated: "2020-01-02T14:28:43.045",
            name: "Abaco",
            id: "GG0k0oNhgS7",
            publicAccess: "rw------",
            lastUpdatedBy: { id: "M5zQapPyTZI" },
            user: { id: "M5zQapPyTZI" },
            userGroupAccesses: [],
            attributeValues: [],
            translations: [],
            userAccesses: [],
            organisationUnits: [{ id: "eu2XF73JOzl" }],
        },
        {
            code: "FUNDER_AGRIDIUS",
            created: "2020-01-02T11:55:10.244",
            lastUpdated: "2020-01-02T14:28:43.050",
            name: "Agridius Foundation",
            id: "em8NIwi0KvM",
            publicAccess: "rw------",
            lastUpdatedBy: { id: "M5zQapPyTZI" },
            user: { id: "M5zQapPyTZI" },
            userGroupAccesses: [],
            attributeValues: [],
            translations: [],
            userAccesses: [],
            organisationUnits: [],
        },
        {
            code: "FUNDER_AC",
            created: "2019-11-18T14:05:05.262",
            lastUpdated: "2020-01-02T14:28:43.050",
            name: "Atlas Copco",
            id: "OKEZCrPzqph",
            shortName: "AC",
            publicAccess: "rw------",
            lastUpdatedBy: { id: "M5zQapPyTZI" },
            user: { id: "M5zQapPyTZI" },
            userGroupAccesses: [],
            attributeValues: [],
            translations: [],
            userAccesses: [],
            organisationUnits: [],
        },
    ],
};

const expectedDataStoreMer = {
    merDataElementIds: ["yMqK9DKbA3X"],
};

const expectedOrgUnitPut = {
    id: "WGC0DJ0YSis",
    name: "MyProject",
    displayName: "MyProject",
    path: "/J0hschZVMBt/eu2XF73JOzl/WGC0DJ0YSis",
    code: "12345en",
    shortName: "MyProject",
    description: "",
    parent: {
        id: "eu2XF73JOzl",
    },
    openingDate: "2018-09-01T00:00:00",
    closedDate: "2019-04-30T23:59:59",
    attributeValues: [
        {
            value: "true",
            attribute: {
                id: "mgCKcJuP5n0",
            },
        },
        {
            value: "WgOMVlwSV2i",
            attribute: {
                id: "aywduilEjPQ",
            },
        },
    ],
};

const expectedSectionsMetadataPost = {
    sections: [
        {
            id: "iSeufpoED2g",
            dataSet: {
                id: "SCS4Dusnfdd",
            },
            sortOrder: 0,
            name: "Agriculture",
            code: "SECTOR_AGRICULTURE_SCS4Dusnfdd",
            dataElements: [
                {
                    id: "WS8XV4WWPE7",
                },
                {
                    id: "K6mAC5SiO29",
                },
                {
                    id: "ik0ICagvIjm",
                },
            ],
            greyedFields: [],
        },
        {
            id: "eIe2SLzuupw",
            dataSet: {
                id: "SCS4Dusnfdd",
            },
            sortOrder: 1,
            name: "Livelihood",
            code: "SECTOR_LIVELIHOOD_SCS4Dusnfdd",
            dataElements: [
                {
                    id: "yMqK9DKbA3X",
                },
                {
                    id: "GQyudNlGzkI",
                },
            ],
            greyedFields: [],
        },
        {
            id: "eY8nZ7go4hl",
            dataSet: {
                id: "CwUxT9UIX3z",
            },
            sortOrder: 0,
            name: "Agriculture",
            code: "SECTOR_AGRICULTURE_CwUxT9UIX3z",
            dataElements: [
                {
                    id: "WS8XV4WWPE7",
                },
                {
                    id: "K6mAC5SiO29",
                },
                {
                    id: "ik0ICagvIjm",
                },
            ],
            greyedFields: [],
        },
        {
            id: "uiiKwDjex3L",
            dataSet: {
                id: "CwUxT9UIX3z",
            },
            sortOrder: 1,
            name: "Livelihood",
            code: "SECTOR_LIVELIHOOD_CwUxT9UIX3z",
            dataElements: [
                {
                    id: "yMqK9DKbA3X",
                },
                {
                    id: "GQyudNlGzkI",
                },
            ],
            greyedFields: [],
        },
    ],
};

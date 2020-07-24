import { getMockApi } from "../../types/d2-api";
import ProjectDb from "../ProjectDb";
import { getProject } from "./project-data";
import { logUnknownRequest } from "../../utils/tests";

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
                expected: {
                    "organisationUnits:fields": "displayName",
                    "organisationUnits:filter": ["code:eq:12345en", "id:ne:WGC0DJ0YSis"],
                },
            }).replyOnce(200, []);

            mock.onGet("/metadata", {
                params: {
                    "organisationUnitGroups:fields": ":owner",
                    "organisationUnitGroups:filter": ["organisationUnits.id:eq:WGC0DJ0YSis"],
                },
            }).replyOnce(200, []);

            mock.onGet("/metadata", {
                params: {
                    "organisationUnitGroups:fields": ":owner",
                    "organisationUnitGroups:filter": [
                        "id:in:[OE0KdZRX2FC,WKUXmz4LIUG,GG0k0oNhgS7]",
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
    merDataElementIds: ["WS8XV4WWPE7", "yMqK9DKbA3X"],
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

const expectedMetadataPost = {
    organisationUnits: [
        {
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
        },
    ],
    organisationUnitGroups: [
        {
            created: "2020-01-02T12:32:30.449",
            lastUpdated: "2020-01-02T14:28:43.045",
            name: "Abaco",
            id: "GG0k0oNhgS7",
            publicAccess: "rw------",
            lastUpdatedBy: {
                id: "M5zQapPyTZI",
            },
            user: {
                id: "M5zQapPyTZI",
            },
            userGroupAccesses: [],
            attributeValues: [],
            translations: [],
            userAccesses: [],
            organisationUnits: [
                {
                    id: "eu2XF73JOzl",
                },
                {
                    id: "WGC0DJ0YSis",
                },
            ],
        },
        {
            code: "FUNDER_AGRIDIUS",
            created: "2020-01-02T11:55:10.244",
            lastUpdated: "2020-01-02T14:28:43.050",
            name: "Agridius Foundation",
            id: "em8NIwi0KvM",
            publicAccess: "rw------",
            lastUpdatedBy: {
                id: "M5zQapPyTZI",
            },
            user: {
                id: "M5zQapPyTZI",
            },
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
            lastUpdatedBy: {
                id: "M5zQapPyTZI",
            },
            user: {
                id: "M5zQapPyTZI",
            },
            userGroupAccesses: [],
            attributeValues: [],
            translations: [],
            userAccesses: [],
            organisationUnits: [],
        },
    ],
    dataSets: [
        {
            id: "SCS4Dusnfdd",
            description: "",
            periodType: "Monthly",
            dataElementDecoration: true,
            renderAsTabs: true,
            categoryCombo: {
                id: "pQjIEZS8Sx7",
            },
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            timelyDays: 0,
            formType: "DEFAULT",
            name: "MyProject Target",
            code: "WGC0DJ0YSis_TARGET",
            attributeValues: [
                {
                    value: "true",
                    attribute: {
                        id: "mgCKcJuP5n0",
                    },
                },
                {
                    value: "WGC0DJ0YSis",
                    attribute: {
                        id: "qgSqj6sBF7j",
                    },
                },
            ],
            workflow: {
                id: "SXvbJzbogqj",
            },
            dataInputPeriods: [
                {
                    period: {
                        id: "201810",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2018-11-30T23:59:59",
                },
                {
                    period: {
                        id: "201811",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2018-11-30T23:59:59",
                },
                {
                    period: {
                        id: "201812",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2018-11-30T23:59:59",
                },
                {
                    period: {
                        id: "201901",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2018-11-30T23:59:59",
                },
                {
                    period: {
                        id: "201902",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2018-11-30T23:59:59",
                },
                {
                    period: {
                        id: "201903",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2018-11-30T23:59:59",
                },
            ],
            openFuturePeriods: 0,
            expiryDays: 0,
            sections: [
                {
                    id: "iSeufpoED2g",
                    code: "SECTOR_AGRICULTURE_SCS4Dusnfdd",
                },
                {
                    id: "eIe2SLzuupw",
                    code: "SECTOR_LIVELIHOOD_SCS4Dusnfdd",
                },
            ],
            dataSetElements: [
                {
                    dataSet: {
                        id: "SCS4Dusnfdd",
                    },
                    dataElement: {
                        id: "WS8XV4WWPE7",
                    },
                    categoryCombo: {
                        id: "bjDvmb4bfuf",
                    },
                },
                {
                    dataSet: {
                        id: "SCS4Dusnfdd",
                    },
                    dataElement: {
                        id: "K6mAC5SiO29",
                    },
                    categoryCombo: {
                        id: "GKWiemQPU5U",
                    },
                },
                {
                    dataSet: {
                        id: "SCS4Dusnfdd",
                    },
                    dataElement: {
                        id: "ik0ICagvIjm",
                    },
                    categoryCombo: {
                        id: "GKWiemQPU5U",
                    },
                },
                {
                    dataSet: {
                        id: "SCS4Dusnfdd",
                    },
                    dataElement: {
                        id: "yMqK9DKbA3X",
                    },
                    categoryCombo: {
                        id: "bjDvmb4bfuf",
                    },
                },
                {
                    dataSet: {
                        id: "SCS4Dusnfdd",
                    },
                    dataElement: {
                        id: "GQyudNlGzkI",
                    },
                    categoryCombo: {
                        id: "GKWiemQPU5U",
                    },
                },
            ],
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [
                {
                    id: "ywuI2WspUUG",
                    displayName: "System Admin",
                    access: "rwrw----",
                },
                {
                    id: "KAQv2ZlGCLn",
                    displayName: "Project Monitoring Admin",
                    access: "rwrw----",
                },
            ],
        },
        {
            id: "CwUxT9UIX3z",
            description: "",
            periodType: "Monthly",
            dataElementDecoration: true,
            renderAsTabs: true,
            categoryCombo: {
                id: "pQjIEZS8Sx7",
            },
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            timelyDays: 0,
            formType: "DEFAULT",
            name: "MyProject Actual",
            code: "WGC0DJ0YSis_ACTUAL",
            attributeValues: [
                {
                    value: "true",
                    attribute: {
                        id: "mgCKcJuP5n0",
                    },
                },
                {
                    value: "WGC0DJ0YSis",
                    attribute: {
                        id: "qgSqj6sBF7j",
                    },
                },
            ],
            workflow: {
                id: "SXvbJzbogqj",
            },
            dataInputPeriods: [
                {
                    period: {
                        id: "201810",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2018-11-10T00:00:00",
                },
                {
                    period: {
                        id: "201811",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2018-12-10T00:00:00",
                },
                {
                    period: {
                        id: "201812",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2019-01-10T00:00:00",
                },
                {
                    period: {
                        id: "201901",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2019-02-10T00:00:00",
                },
                {
                    period: {
                        id: "201902",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2019-03-10T00:00:00",
                },
                {
                    period: {
                        id: "201903",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2019-04-10T00:00:00",
                },
            ],
            openFuturePeriods: 1,
            expiryDays: 11,
            sections: [
                {
                    id: "eY8nZ7go4hl",
                    code: "SECTOR_AGRICULTURE_CwUxT9UIX3z",
                },
                {
                    id: "uiiKwDjex3L",
                    code: "SECTOR_LIVELIHOOD_CwUxT9UIX3z",
                },
            ],
            dataSetElements: [
                {
                    dataSet: {
                        id: "CwUxT9UIX3z",
                    },
                    dataElement: {
                        id: "WS8XV4WWPE7",
                    },
                    categoryCombo: {
                        id: "bjDvmb4bfuf",
                    },
                },
                {
                    dataSet: {
                        id: "CwUxT9UIX3z",
                    },
                    dataElement: {
                        id: "K6mAC5SiO29",
                    },
                    categoryCombo: {
                        id: "GKWiemQPU5U",
                    },
                },
                {
                    dataSet: {
                        id: "CwUxT9UIX3z",
                    },
                    dataElement: {
                        id: "ik0ICagvIjm",
                    },
                    categoryCombo: {
                        id: "GKWiemQPU5U",
                    },
                },
                {
                    dataSet: {
                        id: "CwUxT9UIX3z",
                    },
                    dataElement: {
                        id: "yMqK9DKbA3X",
                    },
                    categoryCombo: {
                        id: "bjDvmb4bfuf",
                    },
                },
                {
                    dataSet: {
                        id: "CwUxT9UIX3z",
                    },
                    dataElement: {
                        id: "GQyudNlGzkI",
                    },
                    categoryCombo: {
                        id: "GKWiemQPU5U",
                    },
                },
            ],
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [
                {
                    id: "ywuI2WspUUG",
                    displayName: "System Admin",
                    access: "rwrw----",
                },
                {
                    id: "KAQv2ZlGCLn",
                    displayName: "Project Monitoring Admin",
                    access: "rwrw----",
                },
            ],
        },
    ],
    dashboards: [
        {
            id: "WgOMVlwSV2i",
            name: "MyProject",
            dashboardItems: [
                {
                    id: "Ka4yijY2Vhl",
                    type: "REPORT_TABLE",
                    reportTable: {
                        id: "i07AWJAND8a",
                    },
                    width: 29,
                    height: 20,
                    x: 0,
                    y: 0,
                },
                {
                    id: "yWGKgz9vaOh",
                    type: "REPORT_TABLE",
                    reportTable: {
                        id: "iqqgnCj9DQj",
                    },
                    width: 29,
                    height: 20,
                    x: 29,
                    y: 0,
                },
                {
                    id: "y2G8oh7xQBm",
                    type: "REPORT_TABLE",
                    reportTable: {
                        id: "GycLEG8dPPO",
                    },
                    width: 29,
                    height: 20,
                    x: 0,
                    y: 20,
                },
                {
                    id: "qMSWdZHPjyN",
                    type: "REPORT_TABLE",
                    reportTable: {
                        id: "aeGIpbJkZAX",
                    },
                    width: 29,
                    height: 20,
                    x: 29,
                    y: 20,
                },
                {
                    id: "uyoJujQVRjE",
                    type: "REPORT_TABLE",
                    reportTable: {
                        id: "GM6SxObVwI3",
                    },
                    width: 29,
                    height: 20,
                    x: 0,
                    y: 40,
                },
                {
                    id: "ys0CVedHirZ",
                    type: "CHART",
                    chart: {
                        id: "uG9C9z46CNK",
                    },
                    width: 58,
                    height: 20,
                    x: 0,
                    y: 60,
                },
                {
                    id: "KI0C90Ol10x",
                    type: "CHART",
                    chart: {
                        id: "qmsj4FqnVPX",
                    },
                    width: 29,
                    height: 20,
                    x: 0,
                    y: 80,
                },
                {
                    id: "qUqsDmtiBLF",
                    type: "CHART",
                    chart: {
                        id: "u6Sin4Fy1Wt",
                    },
                    width: 29,
                    height: 20,
                    x: 29,
                    y: 80,
                },
                {
                    id: "mwMpIdPdu8H",
                    type: "CHART",
                    chart: {
                        id: "ukewRkZsyCI",
                    },
                    width: 29,
                    height: 20,
                    x: 0,
                    y: 100,
                },
            ],
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [
                {
                    id: "ywuI2WspUUG",
                    displayName: "System Admin",
                    access: "rw------",
                },
                {
                    id: "KAQv2ZlGCLn",
                    displayName: "Project Monitoring Admin",
                    access: "rw------",
                },
            ],
        },
    ],
    reportTables: [
        {
            id: "i07AWJAND8a",
            name: "MyProject - Target vs Actual - Benefits",
            numberType: "VALUE",
            legendDisplayStyle: "FILL",
            rowSubTotals: true,
            showDimensionLabels: true,
            aggregationType: "DEFAULT",
            legendDisplayStrategy: "FIXED",
            rowTotals: true,
            digitGroupSeparator: "SPACE",
            dataDimensionItems: [
                {
                    dataDimensionItemType: "DATA_ELEMENT",
                    dataElement: {
                        id: "WS8XV4WWPE7",
                    },
                },
                {
                    dataDimensionItemType: "DATA_ELEMENT",
                    dataElement: {
                        id: "yMqK9DKbA3X",
                    },
                },
            ],
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            periods: [
                {
                    id: "201810",
                },
                {
                    id: "201811",
                },
                {
                    id: "201812",
                },
                {
                    id: "201901",
                },
                {
                    id: "201902",
                },
                {
                    id: "201903",
                },
            ],
            columns: [
                {
                    id: "pe",
                },
            ],
            columnDimensions: ["pe"],
            filters: [
                {
                    id: "ou",
                },
            ],
            filterDimensions: ["ou"],
            rows: [
                {
                    id: "dx",
                },
                {
                    code: "ACTUAL_TARGET",
                    id: "GIIHAr9BzzO",
                    categoryOptions: [
                        {
                            code: "TARGET",
                            id: "imyqCWQ229K",
                        },
                        {
                            code: "ACTUAL",
                            id: "eWeQoOlAcxV",
                        },
                    ],
                },
            ],
            rowDimensions: ["dx", "GIIHAr9BzzO"],
            categoryDimensions: [
                {
                    category: {
                        id: "GIIHAr9BzzO",
                    },
                    categoryOptions: [
                        {
                            id: "imyqCWQ229K",
                        },
                        {
                            id: "eWeQoOlAcxV",
                        },
                    ],
                },
            ],
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [
                {
                    id: "ywuI2WspUUG",
                    displayName: "System Admin",
                    access: "rw------",
                },
                {
                    id: "KAQv2ZlGCLn",
                    displayName: "Project Monitoring Admin",
                    access: "rw------",
                },
            ],
        },
        {
            id: "iqqgnCj9DQj",
            name: "MyProject - Target vs Actual - People",
            numberType: "VALUE",
            legendDisplayStyle: "FILL",
            rowSubTotals: true,
            showDimensionLabels: true,
            aggregationType: "DEFAULT",
            legendDisplayStrategy: "FIXED",
            rowTotals: true,
            digitGroupSeparator: "SPACE",
            dataDimensionItems: [
                {
                    dataDimensionItemType: "DATA_ELEMENT",
                    dataElement: {
                        id: "K6mAC5SiO29",
                    },
                },
                {
                    dataDimensionItemType: "DATA_ELEMENT",
                    dataElement: {
                        id: "ik0ICagvIjm",
                    },
                },
                {
                    dataDimensionItemType: "DATA_ELEMENT",
                    dataElement: {
                        id: "GQyudNlGzkI",
                    },
                },
            ],
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            periods: [
                {
                    id: "201810",
                },
                {
                    id: "201811",
                },
                {
                    id: "201812",
                },
                {
                    id: "201901",
                },
                {
                    id: "201902",
                },
                {
                    id: "201903",
                },
            ],
            columns: [
                {
                    id: "pe",
                },
                {
                    code: "GENDER",
                    id: "Kyg1O6YEGa9",
                    categoryOptions: [
                        {
                            code: "MALE",
                            id: "qk2FihwV6IL",
                        },
                        {
                            code: "FEMALE",
                            id: "yW2hYVS3S4u",
                        },
                    ],
                },
            ],
            columnDimensions: ["pe", "Kyg1O6YEGa9"],
            filters: [
                {
                    id: "ou",
                },
            ],
            filterDimensions: ["ou"],
            rows: [
                {
                    id: "dx",
                },
                {
                    code: "ACTUAL_TARGET",
                    id: "GIIHAr9BzzO",
                    categoryOptions: [
                        {
                            code: "TARGET",
                            id: "imyqCWQ229K",
                        },
                        {
                            code: "ACTUAL",
                            id: "eWeQoOlAcxV",
                        },
                    ],
                },
                {
                    code: "NEW_RETURNING",
                    id: "a0Cy1qwUuZv",
                    categoryOptions: [
                        {
                            code: "NEW",
                            id: "S2y8dcmR2kD",
                        },
                        {
                            code: "RETURNING",
                            id: "CyILz2yY8ey",
                        },
                    ],
                },
            ],
            rowDimensions: ["dx", "GIIHAr9BzzO", "a0Cy1qwUuZv"],
            categoryDimensions: [
                {
                    category: {
                        id: "Kyg1O6YEGa9",
                    },
                    categoryOptions: [
                        {
                            id: "qk2FihwV6IL",
                        },
                        {
                            id: "yW2hYVS3S4u",
                        },
                    ],
                },
                {
                    category: {
                        id: "GIIHAr9BzzO",
                    },
                    categoryOptions: [
                        {
                            id: "imyqCWQ229K",
                        },
                        {
                            id: "eWeQoOlAcxV",
                        },
                    ],
                },
                {
                    category: {
                        id: "a0Cy1qwUuZv",
                    },
                    categoryOptions: [
                        {
                            id: "S2y8dcmR2kD",
                        },
                        {
                            id: "CyILz2yY8ey",
                        },
                    ],
                },
            ],
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [
                {
                    id: "ywuI2WspUUG",
                    displayName: "System Admin",
                    access: "rw------",
                },
                {
                    id: "KAQv2ZlGCLn",
                    displayName: "Project Monitoring Admin",
                    access: "rw------",
                },
            ],
        },
        {
            id: "GycLEG8dPPO",
            name: "MyProject - Target vs Actual - Unique People",
            numberType: "VALUE",
            legendDisplayStyle: "FILL",
            rowSubTotals: true,
            showDimensionLabels: true,
            aggregationType: "DEFAULT",
            legendDisplayStrategy: "FIXED",
            rowTotals: true,
            digitGroupSeparator: "SPACE",
            dataDimensionItems: [
                {
                    dataDimensionItemType: "DATA_ELEMENT",
                    dataElement: {
                        id: "K6mAC5SiO29",
                    },
                },
                {
                    dataDimensionItemType: "DATA_ELEMENT",
                    dataElement: {
                        id: "ik0ICagvIjm",
                    },
                },
                {
                    dataDimensionItemType: "DATA_ELEMENT",
                    dataElement: {
                        id: "GQyudNlGzkI",
                    },
                },
            ],
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            periods: [
                {
                    id: "201810",
                },
                {
                    id: "201811",
                },
                {
                    id: "201812",
                },
                {
                    id: "201901",
                },
                {
                    id: "201902",
                },
                {
                    id: "201903",
                },
            ],
            columns: [
                {
                    id: "pe",
                },
                {
                    code: "GENDER",
                    id: "Kyg1O6YEGa9",
                    categoryOptions: [
                        {
                            code: "MALE",
                            id: "qk2FihwV6IL",
                        },
                        {
                            code: "FEMALE",
                            id: "yW2hYVS3S4u",
                        },
                    ],
                },
            ],
            columnDimensions: ["pe", "Kyg1O6YEGa9"],
            filters: [
                {
                    id: "ou",
                },
                {
                    id: "a0Cy1qwUuZv",
                    categoryOptions: [
                        {
                            code: "NEW",
                            id: "S2y8dcmR2kD",
                            categoryOptionCombos: [
                                {
                                    id: "UU2P0YSJM8A",
                                },
                                {
                                    id: "bOokLlHM9no",
                                },
                                {
                                    id: "kx33GL2khoi",
                                },
                                {
                                    id: "nwv02VfyQuz",
                                },
                            ],
                        },
                    ],
                },
            ],
            filterDimensions: ["ou", "a0Cy1qwUuZv"],
            rows: [
                {
                    id: "dx",
                },
                {
                    code: "ACTUAL_TARGET",
                    id: "GIIHAr9BzzO",
                    categoryOptions: [
                        {
                            code: "TARGET",
                            id: "imyqCWQ229K",
                        },
                        {
                            code: "ACTUAL",
                            id: "eWeQoOlAcxV",
                        },
                    ],
                },
            ],
            rowDimensions: ["dx", "GIIHAr9BzzO"],
            categoryDimensions: [
                {
                    category: {
                        id: "Kyg1O6YEGa9",
                    },
                    categoryOptions: [
                        {
                            id: "qk2FihwV6IL",
                        },
                        {
                            id: "yW2hYVS3S4u",
                        },
                    ],
                },
                {
                    category: {
                        id: "GIIHAr9BzzO",
                    },
                    categoryOptions: [
                        {
                            id: "imyqCWQ229K",
                        },
                        {
                            id: "eWeQoOlAcxV",
                        },
                    ],
                },
                {
                    category: {
                        id: "a0Cy1qwUuZv",
                    },
                    categoryOptions: [
                        {
                            id: "S2y8dcmR2kD",
                        },
                    ],
                },
            ],
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [
                {
                    id: "ywuI2WspUUG",
                    displayName: "System Admin",
                    access: "rw------",
                },
                {
                    id: "KAQv2ZlGCLn",
                    displayName: "Project Monitoring Admin",
                    access: "rw------",
                },
            ],
        },
        {
            id: "aeGIpbJkZAX",
            name: "MyProject - Achieved (%) - Benefits",
            numberType: "VALUE",
            legendDisplayStyle: "FILL",
            rowSubTotals: true,
            showDimensionLabels: true,
            aggregationType: "DEFAULT",
            legendDisplayStrategy: "FIXED",
            rowTotals: true,
            digitGroupSeparator: "SPACE",
            dataDimensionItems: [
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "eCufXa6RkTm",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "i01veyO4Cuw",
                    },
                },
            ],
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            periods: [
                {
                    id: "201810",
                },
                {
                    id: "201811",
                },
                {
                    id: "201812",
                },
                {
                    id: "201901",
                },
                {
                    id: "201902",
                },
                {
                    id: "201903",
                },
            ],
            columns: [
                {
                    id: "pe",
                },
            ],
            columnDimensions: ["pe"],
            filters: [
                {
                    id: "ou",
                },
            ],
            filterDimensions: ["ou"],
            rows: [
                {
                    id: "dx",
                },
            ],
            rowDimensions: ["dx"],
            categoryDimensions: [],
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [
                {
                    id: "ywuI2WspUUG",
                    displayName: "System Admin",
                    access: "rw------",
                },
                {
                    id: "KAQv2ZlGCLn",
                    displayName: "Project Monitoring Admin",
                    access: "rw------",
                },
            ],
            legendSet: {
                code: "ACTUAL_TARGET_ACHIEVED",
                id: "yoAt108kUFm",
            },
        },
        {
            id: "GM6SxObVwI3",
            name: "MyProject - Achieved (%) - People",
            numberType: "VALUE",
            legendDisplayStyle: "FILL",
            rowSubTotals: true,
            showDimensionLabels: true,
            aggregationType: "DEFAULT",
            legendDisplayStrategy: "FIXED",
            rowTotals: true,
            digitGroupSeparator: "SPACE",
            dataDimensionItems: [
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "eYmeRzhBFV4",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "u404ICrBKj3",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "K4sH0aQDdeL",
                    },
                },
            ],
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            periods: [
                {
                    id: "201810",
                },
                {
                    id: "201811",
                },
                {
                    id: "201812",
                },
                {
                    id: "201901",
                },
                {
                    id: "201902",
                },
                {
                    id: "201903",
                },
            ],
            columns: [
                {
                    id: "pe",
                },
            ],
            columnDimensions: ["pe"],
            filters: [
                {
                    id: "ou",
                },
            ],
            filterDimensions: ["ou"],
            rows: [
                {
                    id: "dx",
                },
            ],
            rowDimensions: ["dx"],
            categoryDimensions: [],
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [
                {
                    id: "ywuI2WspUUG",
                    displayName: "System Admin",
                    access: "rw------",
                },
                {
                    id: "KAQv2ZlGCLn",
                    displayName: "Project Monitoring Admin",
                    access: "rw------",
                },
            ],
            legendSet: {
                code: "ACTUAL_TARGET_ACHIEVED",
                id: "yoAt108kUFm",
            },
        },
    ],
    charts: [
        {
            id: "uG9C9z46CNK",
            name: "MyProject - Achieved monthly (%)",
            type: "COLUMN",
            aggregationType: "DEFAULT",
            showData: true,
            category: "dx",
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            dataDimensionItems: [
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "eCufXa6RkTm",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "eYmeRzhBFV4",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "u404ICrBKj3",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "i01veyO4Cuw",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "K4sH0aQDdeL",
                    },
                },
            ],
            periods: [
                {
                    id: "201810",
                },
                {
                    id: "201811",
                },
                {
                    id: "201812",
                },
                {
                    id: "201901",
                },
                {
                    id: "201902",
                },
                {
                    id: "201903",
                },
            ],
            series: "pe",
            columns: [
                {
                    id: "pe",
                },
            ],
            rows: [
                {
                    id: "dx",
                },
            ],
            filters: [
                {
                    id: "ou",
                },
            ],
            filterDimensions: ["ou"],
            categoryDimensions: [],
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [
                {
                    id: "ywuI2WspUUG",
                    displayName: "System Admin",
                    access: "rw------",
                },
                {
                    id: "KAQv2ZlGCLn",
                    displayName: "Project Monitoring Admin",
                    access: "rw------",
                },
            ],
        },
        {
            id: "qmsj4FqnVPX",
            name: "MyProject - Achieved (%)",
            type: "COLUMN",
            aggregationType: "DEFAULT",
            showData: true,
            category: "dx",
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            dataDimensionItems: [
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "eCufXa6RkTm",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "eYmeRzhBFV4",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "u404ICrBKj3",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "i01veyO4Cuw",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "K4sH0aQDdeL",
                    },
                },
            ],
            periods: [
                {
                    id: "201810",
                },
                {
                    id: "201811",
                },
                {
                    id: "201812",
                },
                {
                    id: "201901",
                },
                {
                    id: "201902",
                },
                {
                    id: "201903",
                },
            ],
            series: "ou",
            columns: [
                {
                    id: "ou",
                },
            ],
            rows: [
                {
                    id: "dx",
                },
            ],
            filters: [
                {
                    id: "pe",
                },
            ],
            filterDimensions: ["pe"],
            categoryDimensions: [],
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [
                {
                    id: "ywuI2WspUUG",
                    displayName: "System Admin",
                    access: "rw------",
                },
                {
                    id: "KAQv2ZlGCLn",
                    displayName: "Project Monitoring Admin",
                    access: "rw------",
                },
            ],
        },
        {
            id: "u6Sin4Fy1Wt",
            name: "MyProject - Achieved by gender (%)",
            type: "COLUMN",
            aggregationType: "DEFAULT",
            showData: true,
            category: "dx",
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            dataDimensionItems: [
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "eYmeRzhBFV4",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "u404ICrBKj3",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "K4sH0aQDdeL",
                    },
                },
            ],
            periods: [
                {
                    id: "201810",
                },
                {
                    id: "201811",
                },
                {
                    id: "201812",
                },
                {
                    id: "201901",
                },
                {
                    id: "201902",
                },
                {
                    id: "201903",
                },
            ],
            series: "Kyg1O6YEGa9",
            columns: [
                {
                    code: "GENDER",
                    id: "Kyg1O6YEGa9",
                    categoryOptions: [
                        {
                            code: "MALE",
                            id: "qk2FihwV6IL",
                        },
                        {
                            code: "FEMALE",
                            id: "yW2hYVS3S4u",
                        },
                    ],
                },
            ],
            rows: [
                {
                    id: "dx",
                },
            ],
            filters: [
                {
                    id: "ou",
                },
                {
                    id: "pe",
                },
                {
                    id: "a0Cy1qwUuZv",
                    categoryOptions: [
                        {
                            code: "NEW",
                            id: "S2y8dcmR2kD",
                            categoryOptionCombos: [
                                {
                                    id: "UU2P0YSJM8A",
                                },
                                {
                                    id: "bOokLlHM9no",
                                },
                                {
                                    id: "kx33GL2khoi",
                                },
                                {
                                    id: "nwv02VfyQuz",
                                },
                            ],
                        },
                    ],
                },
            ],
            filterDimensions: ["ou", "pe", "a0Cy1qwUuZv"],
            categoryDimensions: [
                {
                    category: {
                        id: "a0Cy1qwUuZv",
                    },
                    categoryOptions: [
                        {
                            id: "S2y8dcmR2kD",
                        },
                    ],
                },
                {
                    category: {
                        id: "Kyg1O6YEGa9",
                    },
                    categoryOptions: [
                        {
                            id: "qk2FihwV6IL",
                        },
                        {
                            id: "yW2hYVS3S4u",
                        },
                    ],
                },
            ],
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [
                {
                    id: "ywuI2WspUUG",
                    displayName: "System Admin",
                    access: "rw------",
                },
                {
                    id: "KAQv2ZlGCLn",
                    displayName: "Project Monitoring Admin",
                    access: "rw------",
                },
            ],
        },
        {
            id: "ukewRkZsyCI",
            name: "MyProject - Benefits Per Person",
            type: "COLUMN",
            aggregationType: "DEFAULT",
            showData: true,
            category: "dx",
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            dataDimensionItems: [
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "Gob5qHAX60C",
                    },
                },
            ],
            periods: [
                {
                    id: "201810",
                },
                {
                    id: "201811",
                },
                {
                    id: "201812",
                },
                {
                    id: "201901",
                },
                {
                    id: "201902",
                },
                {
                    id: "201903",
                },
            ],
            series: "ou",
            columns: [
                {
                    id: "ou",
                },
            ],
            rows: [
                {
                    id: "dx",
                },
            ],
            filters: [
                {
                    id: "pe",
                },
            ],
            filterDimensions: ["pe"],
            categoryDimensions: [],
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [
                {
                    id: "ywuI2WspUUG",
                    displayName: "System Admin",
                    access: "rw------",
                },
                {
                    id: "KAQv2ZlGCLn",
                    displayName: "Project Monitoring Admin",
                    access: "rw------",
                },
            ],
        },
    ],
};

import moment from "moment";
import _ from "lodash";
import { getMockApi } from "d2-api";
import Project from "../Project";
import { Config } from "../Config";
import configJson from "./config.json";
import ProjectDb from "../ProjectDb";

const { api, mock } = getMockApi();
const config = (configJson as unknown) as Config;

const projectData = {
    name: "MyProject",
    startDate: moment("2018-10-01"),
    endDate: moment("2019-03-01"),
    parentOrgUnit: {
        path: "/J0hschZVMBt/eu2XF73JOzl",
        id: "eu2XF73JOzl",
        displayName: "Bahamas",
    },
    funders: config.funders.slice(0, 2),
    locations: config.locations.filter(location =>
        _.isEqual(location.countries[0], { id: "eu2XF73JOzl" })
    ),
    awardNumber: "12345",
    subsequentLettering: "en",
    sectors: config.sectors.slice(0, 2),
};

async function getProject(): Promise<Project> {
    const initialProject = await Project.create(api, config);
    return initialProject
        .setObj(projectData)
        .updateDataElementsSelection(["WS8XV4WWPE7", "ik0ICagvIjm", "We61YNYyOX0"])
        .project.updateDataElementsMERSelection(["WS8XV4WWPE7", "We61YNYyOX0"]);
}

const metadataResponse = {
    status: "OK",
    stats: { created: 11, updated: 2, deleted: 0, ignored: 0, total: 13 },
};

describe("ProjectDb", () => {
    describe("save", () => {
        it("posts metadata", async () => {
            const project = await getProject();

            mock.onGet("/metadata", {
                params: {
                    "organisationUnitGroups:fields": ":owner",
                    "organisationUnitGroups:filter": [
                        "id:in:[OE0KdZRX2FC,WKUXmz4LIUG,GG0k0oNhgS7,GsGG8967YDU,eCi0GarbBwv]",
                    ],
                },
            }).replyOnce(200, orgUnitsMetadata);

            mock.onPost("/metadata", expectedMetadataPost).replyOnce(200, metadataResponse);

            mock.onPut("/organisationUnits/WGC0DJ0YSis", expectedOrgUnitPut).replyOnce(200);

            mock.onPost(
                "/dataStore/project-monitoring-app/mer-WGC0DJ0YSis",
                expectedDataStoreMer
            ).replyOnce(200);

            mock.onPost("/metadata", expectedMetadataPost).replyOnce(200, metadataResponse);

            jest.spyOn(Date, "now").mockReturnValueOnce(new Date("2019/12/15").getTime());

            await new ProjectDb(project).save();
            expect(true).toEqual(true);
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
    dataElements: ["WS8XV4WWPE7", "We61YNYyOX0"],
};

const expectedOrgUnitPut = {
    id: "WGC0DJ0YSis",
    name: "MyProject",
    displayName: "MyProject",
    path: "/J0hschZVMBt/eu2XF73JOzl/WGC0DJ0YSis",
    code: "en12345",
    shortName: "MyProject",
    description: "",
    parent: { id: "eu2XF73JOzl" },
    openingDate: "2018-09-01T00:00:00",
    closedDate: "2019-04-01T00:00:00",
    organisationUnitGroups: [{ id: "OE0KdZRX2FC" }, { id: "WKUXmz4LIUG" }],
    attributeValues: [
        { value: "true", attribute: { id: "mgCKcJuP5n0" } },
        { value: "ySkG9zkINIY", attribute: { id: "aywduilEjPQ" } },
    ],
};

const expectedMetadataPost = {
    organisationUnits: [
        {
            id: "WGC0DJ0YSis",
            name: "MyProject",
            displayName: "MyProject",
            path: "/J0hschZVMBt/eu2XF73JOzl/WGC0DJ0YSis",
            code: "en12345",
            shortName: "MyProject",
            description: "",
            parent: {
                id: "eu2XF73JOzl",
            },
            openingDate: "2018-09-01T00:00:00",
            closedDate: "2019-04-01T00:00:00",
            organisationUnitGroups: [
                {
                    id: "OE0KdZRX2FC",
                },
                {
                    id: "WKUXmz4LIUG",
                },
            ],
            attributeValues: [
                {
                    value: "true",
                    attribute: {
                        id: "mgCKcJuP5n0",
                    },
                },
                {
                    value: "ySkG9zkINIY",
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
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
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
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
        },
    ],
    dataSets: [
        {
            id: "S0mQyu0r7fd",
            description: "",
            periodType: "Monthly",
            dataElementDecoration: true,
            renderAsTabs: true,
            categoryCombo: {
                id: "qAgB0mD1wC6",
            },
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            dataSetElements: [
                {
                    dataSet: {
                        id: "S0mQyu0r7fd",
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
                        id: "S0mQyu0r7fd",
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
                        id: "S0mQyu0r7fd",
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
                        id: "S0mQyu0r7fd",
                    },
                    dataElement: {
                        id: "We61YNYyOX0",
                    },
                    categoryCombo: {
                        id: "bjDvmb4bfuf",
                    },
                },
                {
                    dataSet: {
                        id: "S0mQyu0r7fd",
                    },
                    dataElement: {
                        id: "yMqK9DKbA3X",
                    },
                    categoryCombo: {
                        id: "bjDvmb4bfuf",
                    },
                },
            ],
            timelyDays: 0,
            formType: "DEFAULT",
            sections: [
                {
                    id: "uIqSSBQ8EGr",
                },
                {
                    id: "qIOamX0NQ5e",
                },
            ],
            name: "MyProject Target",
            code: "WGC0DJ0YSis_TARGET",
            openFuturePeriods: 0,
            dataInputPeriods: [
                {
                    period: {
                        id: "201810",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2018-11-01T00:00:00",
                },
                {
                    period: {
                        id: "201811",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2018-11-01T00:00:00",
                },
                {
                    period: {
                        id: "201812",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2018-11-01T00:00:00",
                },
                {
                    period: {
                        id: "201901",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2018-11-01T00:00:00",
                },
                {
                    period: {
                        id: "201902",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2018-11-01T00:00:00",
                },
                {
                    period: {
                        id: "201903",
                    },
                    openingDate: "2018-10-01T00:00:00",
                    closingDate: "2018-11-01T00:00:00",
                },
            ],
            expiryDays: 0,
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
        },
        {
            id: "aAC2YJRBepp",
            description: "",
            periodType: "Monthly",
            dataElementDecoration: true,
            renderAsTabs: true,
            categoryCombo: {
                id: "qAgB0mD1wC6",
            },
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            dataSetElements: [
                {
                    dataSet: {
                        id: "aAC2YJRBepp",
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
                        id: "aAC2YJRBepp",
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
                        id: "aAC2YJRBepp",
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
                        id: "aAC2YJRBepp",
                    },
                    dataElement: {
                        id: "We61YNYyOX0",
                    },
                    categoryCombo: {
                        id: "bjDvmb4bfuf",
                    },
                },
                {
                    dataSet: {
                        id: "aAC2YJRBepp",
                    },
                    dataElement: {
                        id: "yMqK9DKbA3X",
                    },
                    categoryCombo: {
                        id: "bjDvmb4bfuf",
                    },
                },
            ],
            timelyDays: 0,
            formType: "DEFAULT",
            sections: [
                {
                    id: "qiA7dmxAn82",
                },
                {
                    id: "iCYfUcmklv4",
                },
            ],
            name: "MyProject Actual",
            code: "WGC0DJ0YSis_ACTUAL",
            openFuturePeriods: 1,
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
                    openingDate: "2018-11-01T00:00:00",
                    closingDate: "2018-12-10T00:00:00",
                },
                {
                    period: {
                        id: "201812",
                    },
                    openingDate: "2018-12-01T00:00:00",
                    closingDate: "2019-01-10T00:00:00",
                },
                {
                    period: {
                        id: "201901",
                    },
                    openingDate: "2019-01-01T00:00:00",
                    closingDate: "2019-02-10T00:00:00",
                },
                {
                    period: {
                        id: "201902",
                    },
                    openingDate: "2019-02-01T00:00:00",
                    closingDate: "2019-03-10T00:00:00",
                },
                {
                    period: {
                        id: "201903",
                    },
                    openingDate: "2019-03-01T00:00:00",
                    closingDate: "2019-04-10T00:00:00",
                },
            ],
            expiryDays: 11,
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
        },
    ],
    sections: [
        {
            id: "uIqSSBQ8EGr",
            dataSet: {
                id: "S0mQyu0r7fd",
            },
            sortOrder: 0,
            name: "Agriculture",
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
            id: "qIOamX0NQ5e",
            dataSet: {
                id: "S0mQyu0r7fd",
            },
            sortOrder: 1,
            name: "Livelihoods",
            dataElements: [
                {
                    id: "We61YNYyOX0",
                },
                {
                    id: "yMqK9DKbA3X",
                },
            ],
            greyedFields: [],
        },
        {
            id: "qiA7dmxAn82",
            dataSet: {
                id: "aAC2YJRBepp",
            },
            sortOrder: 0,
            name: "Agriculture",
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
            id: "iCYfUcmklv4",
            dataSet: {
                id: "aAC2YJRBepp",
            },
            sortOrder: 1,
            name: "Livelihoods",
            dataElements: [
                {
                    id: "We61YNYyOX0",
                },
                {
                    id: "yMqK9DKbA3X",
                },
            ],
            greyedFields: [],
        },
    ],
    dashboards: [
        {
            id: "ySkG9zkINIY",
            name: "MyProject",
            dashboardItems: [
                {
                    id: "SOGigOHr1pL",
                    type: "REPORT_TABLE",
                    reportTable: {
                        id: "auqMvs2BvGM",
                    },
                },
                {
                    id: "uWScEWgNkVT",
                    type: "REPORT_TABLE",
                    reportTable: {
                        id: "uqkTSD5ZADF",
                    },
                },
                {
                    id: "Oi2jZzg8tRo",
                    type: "REPORT_TABLE",
                    reportTable: {
                        id: "qOAZdSf1dqI",
                    },
                },
            ],
        },
    ],
    reportTables: [
        {
            id: "auqMvs2BvGM",
            name: "MyProject - PM People Indicators Gender Breakdown",
            publicAccess: "rw------",
            numberType: "VALUE",
            legendDisplayStyle: "FILL",
            showDimensionLabels: true,
            sortOrder: 0,
            topLimit: 0,
            aggregationType: "DEFAULT",
            legendDisplayStrategy: "FIXED",
            colSubTotals: true,
            rowTotals: true,
            digitGroupSeparator: "SPACE",
            columnDimensions: ["pe"],
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
            ],
            columns: [
                {
                    id: "pe",
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
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            filterDimensions: ["ou", "GIIHAr9BzzO"],
            filters: [
                {
                    id: "ou",
                },
                {
                    id: "GIIHAr9BzzO",
                },
            ],
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
                {
                    category: {
                        id: "GIIHAr9BzzO",
                    },
                    categoryOptions: [
                        {
                            id: "eWeQoOlAcxV",
                        },
                    ],
                },
            ],
            rows: [
                {
                    id: "dx",
                },
                {
                    id: "Kyg1O6YEGa9",
                },
                {
                    id: "a0Cy1qwUuZv",
                },
            ],
            rowDimensions: ["dx", "Kyg1O6YEGa9", "a0Cy1qwUuZv"],
        },
        {
            id: "uqkTSD5ZADF",
            name: "MyProject - PM Target vs Actual",
            numberType: "VALUE",
            publicAccess: "rw------",
            legendDisplayStyle: "FILL",
            rowSubTotals: true,
            showDimensionLabels: true,
            sortOrder: 0,
            topLimit: 0,
            aggregationType: "DEFAULT",
            legendDisplayStrategy: "FIXED",
            rowTotals: true,
            digitGroupSeparator: "SPACE",
            filterDimensions: ["ou"],
            columnDimensions: ["pe"],
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
                        id: "We61YNYyOX0",
                    },
                },
                {
                    dataDimensionItemType: "DATA_ELEMENT",
                    dataElement: {
                        id: "yMqK9DKbA3X",
                    },
                },
            ],
            columns: [
                {
                    id: "pe",
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
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            filters: [
                {
                    id: "ou",
                },
            ],
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
            rows: [
                {
                    id: "dx",
                },
                {
                    id: "GIIHAr9BzzO",
                },
            ],
            rowDimensions: ["dx", "GIIHAr9BzzO"],
        },
        {
            id: "qOAZdSf1dqI",
            name: "MyProject - PM Target vs Actual achieved (%)",
            numberType: "VALUE",
            publicAccess: "rw------",
            legendDisplayStyle: "FILL",
            rowSubTotals: true,
            showDimensionLabels: true,
            sortOrder: 0,
            topLimit: 0,
            aggregationType: "DEFAULT",
            legendDisplayStrategy: "FIXED",
            rowTotals: true,
            digitGroupSeparator: "SPACE",
            filterDimensions: ["ou"],
            columnDimensions: ["pe"],
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
                        id: "CaWKoWg00oo",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "i01veyO4Cuw",
                    },
                },
            ],
            columns: [
                {
                    id: "pe",
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
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
                },
            ],
            filters: [
                {
                    id: "ou",
                },
            ],
            categoryDimensions: [],
            rows: [
                {
                    id: "dx",
                },
            ],
            rowDimensions: ["dx"],
        },
    ],
};

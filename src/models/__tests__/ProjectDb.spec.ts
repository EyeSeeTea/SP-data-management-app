import moment from "moment";
import { getMockApi } from "d2-api";
import Project from "../Project";
import { Config } from "../Config";
import configJson from "./config.json";
import ProjectDb from "../ProjectDb";

const { api, mock } = getMockApi();
const config = (configJson as unknown) as Config;

async function getProject(): Promise<Project> {
    const initialProject = await Project.create(api, config);
    return initialProject
        .setObj({
            name: "MyProject",
            startDate: moment("2019-10-01"),
            endDate: moment("2020-03-01"),
            parentOrgUnit: {
                path: "/J0hschZVMBt/PJb0RtEnqlf",
                id: "PJb0RtEnqlf",
                displayName: "Sierra Leona",
            },
            funders: config.funders.slice(0, 2),
            awardNumber: "12345",
            subsequentLettering: "en",
            sectors: config.sectors.slice(0, 2),
        })
        .updateDataElementsSelection(["WS8XV4WWPE7", "ik0ICagvIjm", "We61YNYyOX0"])
        .project.updateDataElementsMERSelection(["WS8XV4WWPE7", "We61YNYyOX0"]);
}

const metadata = {
    organisationUnitGroups: [],
};

const metadataResponse = {
    status: "OK",
    stats: { created: 11, updated: 2, deleted: 0, ignored: 0, total: 13 },
};

describe("ProjectDb", () => {
    describe("save", () => {
        it("posts metadata", async () => {
            const project = await getProject();

            mock.onGet("/metadata", {
                "organisationUnitGroups:fields": ":owner",
                "organisationUnitGroups:filter": ["id:in:[]"],
            }).replyOnce(200, metadata);

            mock.onPost("/metadata", expectedMetadataPost).replyOnce(200, metadataResponse);

            mock.onPut("/organisationUnits/WGC0DJ0YSis", expectedOrgUnitPut).replyOnce(200);

            mock.onPost(
                "/dataStore/project-monitoring-app/mer-WGC0DJ0YSis",
                expectedDataStoreMer
            ).replyOnce(200);

            mock.onPost("/metadata", expectedMetadataPost).replyOnce(200, metadataResponse);

            await new ProjectDb(project).save();
            expect(true).toEqual(true);
        });
    });
});

const expectedDataStoreMer = {
    dataElements: ["WS8XV4WWPE7", "We61YNYyOX0"],
};

const expectedOrgUnitPut = {
    id: "WGC0DJ0YSis",
    name: "MyProject",
    displayName: "MyProject",
    path: "/J0hschZVMBt/PJb0RtEnqlf/WGC0DJ0YSis",
    code: "en12345",
    shortName: "MyProject",
    description: "",
    parent: { id: "PJb0RtEnqlf" },
    openingDate: "2019-09-01T00:00:00",
    closedDate: "2020-04-01T00:00:00",
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
            path: "/J0hschZVMBt/PJb0RtEnqlf/WGC0DJ0YSis",
            code: "en12345",
            shortName: "MyProject",
            description: "",
            parent: {
                id: "PJb0RtEnqlf",
            },
            openingDate: "2019-09-01T00:00:00",
            closedDate: "2020-04-01T00:00:00",
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
    organisationUnitGroups: [],
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
                        id: "yMqK9DKbA3X",
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
                        id: "We61YNYyOX0",
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
            openFuturePeriods: 3,
            dataInputPeriods: [
                {
                    period: {
                        id: "201910",
                    },
                    openingDate: "2019-10-01T00:00:00",
                    closingDate: "2019-11-01T00:00:00",
                },
                {
                    period: {
                        id: "201911",
                    },
                    openingDate: "2019-10-01T00:00:00",
                    closingDate: "2019-11-01T00:00:00",
                },
                {
                    period: {
                        id: "201912",
                    },
                    openingDate: "2019-10-01T00:00:00",
                    closingDate: "2019-11-01T00:00:00",
                },
                {
                    period: {
                        id: "202001",
                    },
                    openingDate: "2019-10-01T00:00:00",
                    closingDate: "2019-11-01T00:00:00",
                },
                {
                    period: {
                        id: "202002",
                    },
                    openingDate: "2019-10-01T00:00:00",
                    closingDate: "2019-11-01T00:00:00",
                },
                {
                    period: {
                        id: "202003",
                    },
                    openingDate: "2019-10-01T00:00:00",
                    closingDate: "2019-11-01T00:00:00",
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
                        id: "yMqK9DKbA3X",
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
                        id: "We61YNYyOX0",
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
                        id: "201910",
                    },
                    openingDate: "2019-10-01T00:00:00",
                    closingDate: "2019-11-10T00:00:00",
                },
                {
                    period: {
                        id: "201911",
                    },
                    openingDate: "2019-11-01T00:00:00",
                    closingDate: "2019-12-10T00:00:00",
                },
                {
                    period: {
                        id: "201912",
                    },
                    openingDate: "2019-12-01T00:00:00",
                    closingDate: "2020-01-10T00:00:00",
                },
                {
                    period: {
                        id: "202001",
                    },
                    openingDate: "2020-01-01T00:00:00",
                    closingDate: "2020-02-10T00:00:00",
                },
                {
                    period: {
                        id: "202002",
                    },
                    openingDate: "2020-02-01T00:00:00",
                    closingDate: "2020-03-10T00:00:00",
                },
                {
                    period: {
                        id: "202003",
                    },
                    openingDate: "2020-03-01T00:00:00",
                    closingDate: "2020-04-10T00:00:00",
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
                    id: "yMqK9DKbA3X",
                },
                {
                    id: "We61YNYyOX0",
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
                    id: "yMqK9DKbA3X",
                },
                {
                    id: "We61YNYyOX0",
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
                    id: "201910",
                },
                {
                    id: "201911",
                },
                {
                    id: "201912",
                },
                {
                    id: "202001",
                },
                {
                    id: "202002",
                },
                {
                    id: "202003",
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
                        id: "yMqK9DKbA3X",
                    },
                },
                {
                    dataDimensionItemType: "DATA_ELEMENT",
                    dataElement: {
                        id: "We61YNYyOX0",
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
                    id: "201910",
                },
                {
                    id: "201911",
                },
                {
                    id: "201912",
                },
                {
                    id: "202001",
                },
                {
                    id: "202002",
                },
                {
                    id: "202003",
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
                            id: "eWeQoOlAcxV",
                        },
                        {
                            id: "imyqCWQ229K",
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
                        id: "i01veyO4Cuw",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "CaWKoWg00oo",
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
                    id: "201910",
                },
                {
                    id: "201911",
                },
                {
                    id: "201912",
                },
                {
                    id: "202001",
                },
                {
                    id: "202002",
                },
                {
                    id: "202003",
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

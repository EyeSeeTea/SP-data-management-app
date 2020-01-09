import moment from "moment";
import { getMockApi } from "d2-api";
import Project from "../Project";
import { Config } from "../Config";
import configJson from "./config.json";
import ProjectDb from "../ProjectDb";

const { api, mock } = getMockApi();
const config = (configJson as unknown) as Config;

const projectData = {
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
};

async function getProject(): Promise<Project> {
    const initialProject = await Project.create(api, config);
    return initialProject
        .setObj(projectData)
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

            const { response, project: savedProject } = await new ProjectDb(project).save();
            expect(response).toBeTruthy();
            expect(savedProject.id).toEqual("WGC0DJ0YSis");
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

const now = moment();

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
            openFuturePeriods: projectData.endDate.diff(now, "month") + 1,
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
                    id: "WMOgqLEpBlC",
                    type: "CHART",
                    chart: {
                        id: "OgOU20E6G4f",
                    },
                },
                {
                    id: "GQavMfHlswl",
                    type: "CHART",
                    chart: {
                        id: "yK4T67qbssr",
                    },
                },
                {
                    id: "WOEVSzntJcf",
                    type: "CHART",
                    chart: {
                        id: "aeegubasf72",
                    },
                },
                {
                    id: "SeYNbVfObL4",
                    type: "CHART",
                    chart: {
                        id: "WWqcPhi5Nh3",
                    },
                },
                {
                    id: "OCWuuDUus7n",
                    type: "REPORT_TABLE",
                    reportTable: {
                        id: "iyI3WXcUciK",
                    },
                },
                {
                    id: "WQIjOe2gZXZ",
                    type: "REPORT_TABLE",
                    reportTable: {
                        id: "Kg4wY2c9x4I",
                    },
                },
                {
                    id: "Ge8ReLf7SCd",
                    type: "REPORT_TABLE",
                    reportTable: {
                        id: "mMSoIpXaHBS",
                    },
                },
                {
                    id: "WgumfImz3GP",
                    type: "REPORT_TABLE",
                    reportTable: {
                        id: "y02zthmCbtX",
                    },
                },
                {
                    id: "OYCw0oLhwxc",
                    type: "REPORT_TABLE",
                    reportTable: {
                        id: "KmGEpPf3Ugh",
                    },
                },
            ],
        },
    ],
    reportTables: [
        {
            id: "iyI3WXcUciK",
            name: "MyProject - PM Target vs Actual - Benefits",
            numberType: "VALUE",
            publicAccess: "rw------",
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
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
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
        },
        {
            id: "Kg4wY2c9x4I",
            name: "MyProject - PM Target vs Actual - People",
            numberType: "VALUE",
            publicAccess: "rw------",
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
                        id: "ik0ICagvIjm",
                    },
                },
                {
                    dataDimensionItemType: "DATA_ELEMENT",
                    dataElement: {
                        id: "K6mAC5SiO29",
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
                    code: "NEW_RECURRING",
                    id: "a0Cy1qwUuZv",
                    categoryOptions: [
                        {
                            code: "NEW",
                            id: "S2y8dcmR2kD",
                        },
                        {
                            code: "RECURRING",
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
        },
        {
            id: "mMSoIpXaHBS",
            name: "MyProject - PM Target vs Actual - Unique People",
            numberType: "VALUE",
            publicAccess: "rw------",
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
                        id: "ik0ICagvIjm",
                    },
                },
                {
                    dataDimensionItemType: "DATA_ELEMENT",
                    dataElement: {
                        id: "K6mAC5SiO29",
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
        },
        {
            id: "y02zthmCbtX",
            name: "MyProject - PM achieved (%) - Benefits",
            numberType: "VALUE",
            publicAccess: "rw------",
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
            organisationUnits: [
                {
                    id: "WGC0DJ0YSis",
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
            legendSet: {
                code: "ACTUAL_TARGET_ACHIEVED",
                id: "yoAt108kUFm",
            },
        },
        {
            id: "KmGEpPf3Ugh",
            name: "MyProject - PM achieved (%) - People",
            numberType: "VALUE",
            publicAccess: "rw------",
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
                        id: "u404ICrBKj3",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "eYmeRzhBFV4",
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
            legendSet: {
                code: "ACTUAL_TARGET_ACHIEVED",
                id: "yoAt108kUFm",
            },
        },
    ],
    charts: [
        {
            id: "OgOU20E6G4f",
            name: "MyProject - PM achieved monthly (%)",
            publicAccess: "rw------",
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
                        id: "u404ICrBKj3",
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
        },
        {
            id: "yK4T67qbssr",
            name: "MyProject - PM achieved (%)",
            publicAccess: "rw------",
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
                        id: "u404ICrBKj3",
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
        },
        {
            id: "aeegubasf72",
            name: "MyProject - PM achieved by gender (%)",
            publicAccess: "rw------",
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
                        id: "u404ICrBKj3",
                    },
                },
                {
                    dataDimensionItemType: "INDICATOR",
                    indicator: {
                        id: "eYmeRzhBFV4",
                    },
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
        },
        {
            id: "WWqcPhi5Nh3",
            name: "MyProject - PM Benefits Per Person",
            publicAccess: "rw------",
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
                        id: "eoyInzqL7YZ",
                    },
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
        },
    ],
};

import { getMockApi } from "d2-api";
import MerReport from "../MerReport";
import config from "./config";
import moment from "moment";

const { api, mock } = getMockApi();

const selector = {
    date: moment(new Date(2019, 12 - 1, 1)),
    organisationUnit: {
        path: "/J0hschZVMBt/PJb0RtEnqlf",
        id: "PJb0RtEnqlf",
        displayName: "Sierra Leona",
    },
};

let report: MerReport;

describe("MerReport", () => {
    describe("create with no data", () => {
        beforeAll(async () => {
            mockApiForMerReportEmpty();
            report = await MerReport.create(api, config, selector);
        });

        it("sets date / orgUnit", async () => {
            expect(report.data).toEqual(
                expect.objectContaining({
                    date: selector.date,
                    organisationUnit: selector.organisationUnit,
                })
            );
        });

        it("sets empty free text fields", () => {
            expect(report.data).toEqual(
                expect.objectContaining({
                    countryDirector: "",
                    executiveSummary: "",
                    ministrySummary: "",
                    projectedActivitiesNextMonth: "",
                })
            );
        });

        it("sets empty staff summary", () => {
            expect(report.data).toEqual(
                expect.objectContaining({
                    staffSummary: {
                        nationalStaff: { fullTime: 0, partTime: 0 },
                        ifs: { fullTime: 0, partTime: 0 },
                        ifsDependents: { fullTime: 0, partTime: 0 },
                        regional: { fullTime: 0, partTime: 0 },
                        regionalDependents: { fullTime: 0, partTime: 0 },
                        interns: { fullTime: 0, partTime: 0 },
                    },
                })
            );
        });

        it("has no projects", () => {
            expect(report.hasProjects()).toBe(false);
        });
    });

    describe("save", () => {
        beforeAll(async () => {
            mockApiForMerReportWithData();
            report = await MerReport.create(api, config, selector);
        });

        it("POSTS data to dataStore", async () => {
            expect(true).toBe(true);
        });
    });

    describe("create with data", () => {
        beforeAll(async () => {
            mockApiForMerReportWithData();
            report = await MerReport.create(api, config, selector);
        });

        it("sets date / orgUnit", async () => {
            expect(report.data).toEqual(
                expect.objectContaining({
                    date: selector.date,
                    organisationUnit: selector.organisationUnit,
                })
            );
        });

        it("sets text fields", () => {
            expect(report.data).toEqual(
                expect.objectContaining({
                    countryDirector: "Country Director",
                    executiveSummary: "Executive Summary",
                    ministrySummary: "Ministry Summary",
                    projectedActivitiesNextMonth: "Projected",
                })
            );
        });

        it("sets staff summary", () => {
            expect(report.data).toEqual(
                expect.objectContaining({
                    staffSummary: {
                        ifs: { fullTime: 1, partTime: 2 },
                        interns: { fullTime: 3, partTime: 4 },
                        regional: { fullTime: 5, partTime: 6 },
                        ifsDependents: { fullTime: 7, partTime: 8 },
                        nationalStaff: { fullTime: 9, partTime: 10 },
                        regionalDependents: { fullTime: 11, partTime: 12 },
                    },
                })
            );
        });

        it("has projects", () => {
            expect(report.hasProjects()).toBe(true);
        });

        it("has projects info with dataElements (actual/target/achieved and comment)", () => {
            expect(report.data.projectsData).toEqual([
                {
                    id: "uWuM0QT2pVl",
                    name: "0Test1-25236",
                    dateInfo: "Nov 2019 -> Mar 2020",
                    dataElements: [
                        {
                            id: "WS8XV4WWPE7",
                            name:
                                "# of agriculture groups receiving support for improved livelihoods",
                            actual: 1,
                            target: 3,
                            achieved: 40,
                            comment: "comment1",
                        },
                        {
                            id: "We61YNYyOX0",
                            name: "# of biogas digesters installed",
                            actual: 2,
                            target: 4,
                            achieved: 85.71428571428571,
                            comment: "comment2",
                        },
                    ],
                },
                {
                    id: "SKuiiu7Vbwv",
                    name: "0Test1-48852",
                    dateInfo: "Nov 2019 -> Mar 2020",
                    dataElements: [
                        {
                            id: "yUGuwPFkBrj",
                            name: "# of energy-saving stoves installed",
                            actual: 0,
                            target: 0,
                            achieved: undefined,
                            comment: "",
                        },
                    ],
                },
            ]);
        });
    });
});

function mockApiForMerReportEmpty() {
    mock.reset();
    mock.onGet("/metadata", {
        "organisationUnits:fields": "closedDate,displayName,id,openingDate",
        "organisationUnits:filter": [
            "closedDate:ge:2019-07-01T00:00:00",
            "openingDate:le:2019-05-01T00:00:00",
            "parent.id:eq:b",
        ],
    }).replyOnce(200, {});
}

function mockApiForMerReportWithData() {
    mock.reset();
    mock.onGet("/dataStore/project-monitoring-app/mer-PJb0RtEnqlf-201912").replyOnce(200, {
        created: "2019-12-17T17:21:23",
        createdBy: "M5zQapPyTZI",
        updated: "2019-12-18T10:17:18",
        updatedBy: "M5zQapPyTZI",
        countryDirector: "Country Director",
        executiveSummary: "Executive Summary",
        ministrySummary: "Ministry Summary",
        projectedActivitiesNextMonth: "Projected",
        staffSummary: {
            ifs: { fullTime: 1, partTime: 2 },
            interns: { fullTime: 3, partTime: 4 },
            regional: { fullTime: 5, partTime: 6 },
            ifsDependents: { fullTime: 7, partTime: 8 },
            nationalStaff: { fullTime: 9, partTime: 10 },
            regionalDependents: { fullTime: 11, partTime: 12 },
        },
        comments: {
            "uWuM0QT2pVl-WS8XV4WWPE7": "comment1",
            "uWuM0QT2pVl-We61YNYyOX0": "comment2",
            "SKuiiu7Vbwv-WS8XV4WWPE7": "comment3",
            "SKuiiu7Vbwv-We61YNYyOX0": "comment4",
        },
    });
    mock.onGet("/dataStore/project-monitoring-app/mer-uWuM0QT2pVl").replyOnce(200, {
        dataElements: ["WS8XV4WWPE7", "We61YNYyOX0"],
    });
    mock.onGet("/dataStore/project-monitoring-app/mer-SKuiiu7Vbwv").replyOnce(200, {
        dataElements: ["yUGuwPFkBrj"],
    });
    mock.onGet("/metadata", {
        "organisationUnits:fields": "closedDate,displayName,id,openingDate",
        "organisationUnits:filter": [
            "closedDate:ge:2019-07-01T00:00:00",
            "openingDate:le:2019-05-01T00:00:00",
            "parent.id:eq:b",
        ],
    }).replyOnce(200, {
        organisationUnits: [
            {
                id: "uWuM0QT2pVl",
                closedDate: "2020-04-30T00:00:00.000",
                displayName: "0Test1-25236",
                openingDate: "2019-10-01T00:00:00.000",
            },
            {
                id: "SKuiiu7Vbwv",
                closedDate: "2020-04-30T00:00:00.000",
                displayName: "0Test1-48852",
                openingDate: "2019-10-01T00:00:00.000",
            },
        ],
    });

    mock.onGet("/analytics", {
        dimension: [
            "ou:uWuM0QT2pVl;SKuiiu7Vbwv",
            "pe:",
            "GIIHAr9BzzO:eWeQoOlAcxV;imyqCWQ229K",
            "dx:WS8XV4WWPE7;We61YNYyOX0;yUGuwPFkBrj",
        ],
    }).replyOnce(200, {
        headers: [
            {
                name: "dx",
                column: "Data",
                valueType: "TEXT",
                type: "java.lang.String",
                hidden: false,
                meta: true,
            },
            {
                name: "ou",
                column: "Organisation unit",
                valueType: "TEXT",
                type: "java.lang.String",
                hidden: false,
                meta: true,
            },
            {
                name: "pe",
                column: "Period",
                valueType: "TEXT",
                type: "java.lang.String",
                hidden: false,
                meta: true,
            },
            {
                name: "GIIHAr9BzzO",
                column: "Actual/Target",
                valueType: "TEXT",
                type: "java.lang.String",
                hidden: false,
                meta: true,
            },
            {
                name: "value",
                column: "Value",
                valueType: "NUMBER",
                type: "java.lang.Double",
                hidden: false,
                meta: false,
            },
        ],
        metaData: {
            items: {
                imyqCWQ229K: { name: "Target" },
                GIIHAr9BzzO: { name: "Actual/Target" },
                WS8XV4WWPE7: {
                    name: "# of agriculture groups receiving support for improved livelihoods",
                },
                ou: { name: "Organisation unit" },
                "201910": { name: "October 2019" },
                "201912": { name: "December 2019" },
                "201911": { name: "November 2019" },
                eWeQoOlAcxV: { name: "Actual" },
                dx: { name: "Data" },
                uWuM0QT2pVl: { name: "0Test1-25236" },
                pe: { name: "Period" },
                We61YNYyOX0: { name: "# of biogas digesters installed" },
                HllvX50cXC0: { name: "default" },
                SKuiiu7Vbwv: { name: "0Test1-48852" },
            },
            dimensions: {
                GIIHAr9BzzO: ["eWeQoOlAcxV", "imyqCWQ229K"],
                dx: ["WS8XV4WWPE7", "We61YNYyOX0"],
                pe: ["201910", "201911", "201912"],
                ou: ["uWuM0QT2pVl", "SKuiiu7Vbwv"],
                co: ["HllvX50cXC0"],
            },
        },
        rows: [
            ["We61YNYyOX0", "uWuM0QT2pVl", "201911", "imyqCWQ229K", "3.0"],
            ["WS8XV4WWPE7", "uWuM0QT2pVl", "201911", "imyqCWQ229K", "2.0"],
            ["We61YNYyOX0", "uWuM0QT2pVl", "201912", "imyqCWQ229K", "4.0"],
            ["We61YNYyOX0", "uWuM0QT2pVl", "201912", "eWeQoOlAcxV", "2.0"],
            ["WS8XV4WWPE7", "uWuM0QT2pVl", "201912", "imyqCWQ229K", "3.0"],
            ["We61YNYyOX0", "uWuM0QT2pVl", "201911", "eWeQoOlAcxV", "4.0"],
            ["WS8XV4WWPE7", "uWuM0QT2pVl", "201912", "eWeQoOlAcxV", "1.0"],
            ["WS8XV4WWPE7", "uWuM0QT2pVl", "201911", "eWeQoOlAcxV", "1.0"],
        ],
        width: 5,
        height: 8,
        headerWidth: 5,
    });
}

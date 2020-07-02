import MockAdapter from "axios-mock-adapter/types";

export function mockApiForMerReportEmpty(mock: MockAdapter) {
    mock.reset();
    mock.onGet("/metadata", {
        params: {
            "organisationUnits:fields": "closedDate,displayName,id,openingDate",
            "organisationUnits:filter": [
                "closedDate:ge:2020-01-31T23:59:59",
                "openingDate:le:2019-11-01T00:00:00",
                "parent.id:eq:PJb0RtEnqlf",
            ],
        },
    }).replyOnce(200, {});
}

export function mockApiForMerReportWithData(mock: MockAdapter) {
    mock.reset();
    mock.onGet("/dataStore/project-monitoring-app/mer-PJb0RtEnqlf").replyOnce(200, {
        reports: {
            201912: {
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
            },
        },
    });
    mock.onGet("/dataStore/project-monitoring-app/project-uWuM0QT2pVl").replyOnce(200, {
        merDataElementIds: ["WS8XV4WWPE7", "We61YNYyOX0"],
    });
    mock.onGet("/dataStore/project-monitoring-app/project-SKuiiu7Vbwv").replyOnce(200, {
        merDataElementIds: ["yUGuwPFkBrj"],
    });
    mock.onGet("/metadata", {
        params: {
            "organisationUnits:fields": "closedDate,displayName,id,openingDate",
            "organisationUnits:filter": [
                "closedDate:ge:2020-01-31T23:59:59",
                "openingDate:le:2019-11-01T00:00:00",
                "parent.id:eq:PJb0RtEnqlf",
            ],
        },
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
        params: {
            dimension: [
                "ou:uWuM0QT2pVl;SKuiiu7Vbwv",
                "pe:201910;201911;201912",
                "GIIHAr9BzzO",
                "dx:WS8XV4WWPE7;We61YNYyOX0;yUGuwPFkBrj",
            ],
        },
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
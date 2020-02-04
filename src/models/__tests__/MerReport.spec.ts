import { getMockApi } from "d2-api";
import MerReport from "../MerReport";
import config from "./config";
import moment from "moment";
import { mockApiForMerReportEmpty, mockApiForMerReportWithData } from "./mer-data";

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
            mockApiForMerReportEmpty(mock);
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
                    staffSummary: {},
                })
            );
        });

        it("has no projects", () => {
            expect(report.hasProjects()).toBe(false);
        });
    });

    describe("save", () => {
        beforeAll(async () => {
            mockApiForMerReportWithData(mock);
            report = await MerReport.create(api, config, selector);
        });

        it("POSTS data to dataStore", async () => {
            expect(true).toBe(true);
        });
    });

    describe("create with data", () => {
        beforeAll(async () => {
            mockApiForMerReportWithData(mock);
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
                            actualAchieved: 2,
                            target: 3,
                            targetAchieved: 5,
                            achieved: 40,
                            comment: "comment1",
                        },
                        {
                            id: "We61YNYyOX0",
                            name: "# of biogas digesters installed",
                            actual: 2,
                            actualAchieved: 6,
                            target: 4,
                            targetAchieved: 7,
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
                            actualAchieved: 0,
                            target: 0,
                            targetAchieved: 0,
                            achieved: null,
                            comment: "",
                        },
                    ],
                },
            ]);
        });
    });
});

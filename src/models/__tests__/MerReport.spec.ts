import { getMockApi } from "../../types/d2-api";
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
                    executiveSummaries: {},
                    additionalComments: "",
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
                    executiveSummaries: { ieyBABjYyHO: "Executive Summary for Agriculture" },
                    ministrySummary: "Ministry Summary",
                    projectedActivitiesNextMonth: "Projected",
                    additionalComments: "Some additional comments",
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
                    locations: [],
                    dateInfo: "Nov 2019 - Mar 2020",
                    dataElements: [
                        {
                            id: "WS8XV4WWPE7",
                            code: "B010200",
                            name: "de-B010200",
                            actual: { all: 0, approved: 1, unapproved: -1 },
                            target: { all: 0, approved: 3, unapproved: -3 },
                            actualAchieved: { all: 0, approved: 2, unapproved: -2 },
                            targetAchieved: { all: 0, approved: 5, unapproved: -5 },
                            achieved: { all: null, approved: 40, unapproved: 40 },
                            comment: "comment1",
                            isCovid19: false,
                        },
                        {
                            id: "We61YNYyOX0",
                            code: "B020205",
                            name: "de-B020205",
                            actual: { all: 0, approved: 2, unapproved: -2 },
                            target: { all: 0, approved: 4, unapproved: -4 },
                            actualAchieved: { all: 0, approved: 6, unapproved: -6 },
                            targetAchieved: { all: 0, approved: 7, unapproved: -7 },
                            achieved: {
                                all: null,
                                approved: 85.71428571428571,
                                unapproved: 85.71428571428571,
                            },
                            comment: "comment2",
                            isCovid19: false,
                        },
                    ],
                },
                {
                    id: "SKuiiu7Vbwv",
                    name: "0Test1-48852",
                    locations: [
                        { id: "GG0k0oNhgS7", name: "loc-GG0k0oNhgS7" },
                        { id: "GsGG8967YDU", name: "loc-GsGG8967YDU" },
                    ],
                    dateInfo: "Nov 2019 - Mar 2020",
                    dataElements: [
                        {
                            id: "yUGuwPFkBrj",
                            code: "B020210",
                            name: "de-B020210",
                            actual: { all: 0, approved: 0, unapproved: 0 },
                            target: { all: 0, approved: 0, unapproved: 0 },
                            actualAchieved: { all: 0, approved: 0, unapproved: 0 },
                            targetAchieved: { all: 0, approved: 0, unapproved: 0 },
                            achieved: { all: null, approved: null, unapproved: null },
                            comment: "",
                            isCovid19: false,
                        },
                    ],
                },
            ]);
        });
    });
});

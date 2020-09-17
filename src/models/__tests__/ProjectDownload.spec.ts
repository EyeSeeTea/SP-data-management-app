import ExcelJS, { Workbook } from "exceljs";
import _ from "lodash";
import { getMockApi } from "../../types/d2-api";
import Project from "../Project";
import { getProject } from "./project-data";
import moment from "moment";
import analyticsPeopleResponse from "./data/project-download-people-analytics.json";
import analyticsBenefitsResponse from "./data/project-download-benefits-analytics.json";
import { logUnknownRequest } from "../../utils/tests";

const { api, mock } = getMockApi();

let project: Project;
let filename: string;
let buffer: ArrayBuffer;
let workbook: Workbook;

describe("ProjectDownload", () => {
    describe("generate", () => {
        beforeAll(async () => {
            mock.onGet("/analytics", {
                params: {
                    dimension: [
                        "ou:WGC0DJ0YSis",
                        "pe:202001;202002;202003;202004",
                        "dx:WS8XV4WWPE7;K6mAC5SiO29;ik0ICagvIjm;yMqK9DKbA3X;GQyudNlGzkI",
                        "GIIHAr9BzzO",
                        "uSMHdwhxFSV",
                        "Kyg1O6YEGa9",
                    ],
                },
            }).replyOnce(200, analyticsPeopleResponse);

            mock.onGet("/analytics", {
                params: {
                    dimension: [
                        "ou:WGC0DJ0YSis",
                        "pe:202001;202002;202003;202004",
                        "dx:WS8XV4WWPE7;K6mAC5SiO29;ik0ICagvIjm;yMqK9DKbA3X;GQyudNlGzkI",
                        "GIIHAr9BzzO",
                    ],
                },
            }).replyOnce(200, analyticsBenefitsResponse);

            logUnknownRequest(mock);

            project = getProject(api, {
                startDate: moment("2020-01-01"),
                endDate: moment("2020-04-30"),
            });
            ({ filename, buffer } = await project.download());
            workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            // await workbook.xlsx.writeFile("test.xlsx"); // TO DEBUG
        });

        it("creates a XLSX-named file", async () => {
            expect(filename).toEqual("Activity Monitoring - MyProject.xlsx");
        });

        it("creates a XLSX-named file with 2 tabs", async () => {
            expect(workbook.getWorksheet("Benefit")).toBeDefined();
            expect(workbook.getWorksheet("People")).toBeDefined();
        });

        it("should have a Benefit tab with data", () => {
            const sheet = workbook.getWorksheet("Benefit");
            expect(sheet).toBeDefined();

            const values = getSheetValues(sheet);

            const expectedValues = [
                [
                    "MyProject - ACTIVITY MONITORING - BENEFIT",
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    "#",
                    "Indicator Code",
                    "Activity Indicator",
                    "Data Type",
                    "Jan-20",
                    "Feb-20",
                    "Mar-20",
                    "Apr-20",
                    "Cumulative",
                    "Method of Data Collection",
                    "Person Responsible",
                ],
                [
                    "1",
                    "B010200",
                    "de-B010200",
                    "% Achievement to Date",
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "",
                    "",
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    "Target Benefit",
                    4,
                    3,
                    8,
                    6,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    "Actual Benefit",
                    1,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    "2",
                    "B020200",
                    "de-B020200",
                    "% Achievement to Date",
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "",
                    "",
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    "Target Benefit",
                    7,
                    3,
                    9,
                    7,
                    undefined,
                    undefined,
                    undefined,
                ],
            ];
            expect(values).toEqual(expectedValues);
        });

        it("should have a People tab with data", () => {
            const sheet = workbook.getWorksheet("People");
            expect(sheet).toBeDefined();

            const values = getSheetValues(sheet);

            const expectedValues = [
                [
                    "MyProject - ACTIVITY MONITORING - PEOPLE",
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    "#",
                    "Indicator Code",
                    "Counting Method",
                    "Activity Indicator",
                    "Data Type",
                    "Jan-20",
                    "Feb-20",
                    "Mar-20",
                    "Apr-20",
                    "Cumulative",
                    "Method of Data Collection",
                    "Person Responsible",
                ],
                [
                    "1",
                    "P010100",
                    "",
                    "de-P010100",
                    "Total People Targeted",
                    19,
                    17,
                    20,
                    33,
                    undefined,
                    "",
                    "",
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Male New",
                    6,
                    1,
                    10,
                    5,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Female New",
                    1,
                    2,
                    5,
                    10,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Male Returning",
                    7,
                    10,
                    3,
                    10,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Female Returning",
                    5,
                    4,
                    2,
                    8,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "% Achievement to Date",
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "",
                    "",
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Total Actual People",
                    22,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Male New",
                    6,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Female New",
                    8,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Male Returning",
                    2,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Female Returning",
                    6,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    "2",
                    "P010101",
                    "",
                    "de-P010101",
                    "Total People Targeted",
                    17,
                    20,
                    17,
                    23,
                    undefined,
                    "",
                    "",
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Male New",
                    3,
                    7,
                    7,
                    4,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Female New",
                    2,
                    3,
                    4,
                    10,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Male Returning",
                    3,
                    8,
                    1,
                    5,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Female Returning",
                    9,
                    2,
                    5,
                    4,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "% Achievement to Date",
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "",
                    "",
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Total Actual People",
                    20,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Male New",
                    4,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Female New",
                    4,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Male Returning",
                    9,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Female Returning",
                    3,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    "3",
                    "P020300",
                    "",
                    "de-P020300",
                    "Total People Targeted",
                    0,
                    0,
                    0,
                    0,
                    undefined,
                    "",
                    "",
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Male New",
                    0,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Female New",
                    0,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Male Returning",
                    0,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Female Returning",
                    0,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "% Achievement to Date",
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "",
                    "",
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Total Actual People",
                    0,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Male New",
                    0,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Female New",
                    0,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
                [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    "Male Returning",
                    0,
                    0,
                    0,
                    0,
                    undefined,
                    undefined,
                    undefined,
                ],
            ];

            expect(values).toEqual(expectedValues);
        });
    });
});

function getSheetValues(sheet: ExcelJS.Worksheet) {
    return _(1)
        .range(sheet.rowCount)
        .map(nRow => {
            const { model } = sheet.getRow(nRow);
            return model ? (model.cells || []).map(cell => cell.value) : null;
        })
        .compact()
        .value();
}

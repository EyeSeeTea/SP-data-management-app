import ExcelJS from "exceljs";
import _ from "lodash";
import { getMockApi } from "d2-api";
import Project from "../Project";
import { getProject } from "./project-data";

const { api, mock } = getMockApi();

let project: Project;
let filename: string;
let buffer: ArrayBuffer;

describe("ProjectDownload", () => {
    describe("generate", () => {
        beforeAll(async () => {
            mock.onGet("/analytics", {
                params: {
                    dimension: [
                        "ou:WGC0DJ0YSis",
                        "pe:201810;201811;201812;201901;201902;201903",
                        "dx:WS8XV4WWPE7;ik0ICagvIjm;K6mAC5SiO29;We61YNYyOX0;yMqK9DKbA3X",
                        "GIIHAr9BzzO",
                        "a0Cy1qwUuZv",
                        "Kyg1O6YEGa9",
                    ],
                },
            }).replyOnce(200, { rows: [] });

            mock.onGet("/analytics", {
                params: {
                    dimension: [
                        "ou:WGC0DJ0YSis",
                        "pe:201810;201811;201812;201901;201902;201903",
                        "dx:WS8XV4WWPE7;ik0ICagvIjm;K6mAC5SiO29;We61YNYyOX0;yMqK9DKbA3X",
                        "GIIHAr9BzzO",
                    ],
                },
            }).replyOnce(200, { rows: [] });

            project = getProject(api);
            ({ filename, buffer } = await project.download());
        });

        it("creates a XLSX-named file", async () => {
            expect(filename).toEqual("Activity Monitoring - MyProject.xlsx");
        });

        it("creates a XLSX-named file with 2 tabs", async () => {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);

            expect(workbook.getWorksheet("Benefits")).toBeDefined();
            expect(workbook.getWorksheet("People")).toBeDefined();
        });
    });
});

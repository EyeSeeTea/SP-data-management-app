import ExcelJS, { CellValue, Font, Alignment, Worksheet, Workbook, Column } from "exceljs";
import _ from "lodash";
import moment from "moment";
import MerReport, { staffKeys, getStaffTranslations } from "./MerReport";
import i18n from "../locales";

type Value = TextValue | NumberValue;

type Row = Value[];

interface ValueBase {
    font?: Partial<Font>;
    alignment?: Partial<Alignment>;
    height?: number;
}

interface NumberValue extends ValueBase {
    type: "number";
    value: number;
}

interface TextValue extends ValueBase {
    type: "text";
    value: string;
}

class MerReportSpreadsheet {
    constructor(public merReport: MerReport) {}

    async generate(): Promise<{ blob: Blob; filename: string }> {
        const { merReport } = this;
        const { date, organisationUnit } = merReport.data;
        const { config } = this.merReport;
        if (!date || !organisationUnit) throw new Error("No data");

        const now = moment();
        const workbook = new ExcelJS.Workbook();

        workbook.creator = config.currentUser.displayName;
        workbook.lastModifiedBy = config.currentUser.displayName;
        workbook.created = now.toDate();
        workbook.modified = now.toDate();

        this.addNarrativeSheet(workbook);
        this.addActivitesSheet(workbook);

        const res = await workbook.xlsx.writeBuffer();
        const blob = new Blob([res], { type: "application/octet-stream" });
        const orgUnitName = organisationUnit.displayName;
        const filename = ["MER", orgUnitName, date.format("YYYY_MM")].join("-") + ".xlsx";
        return { filename, blob };
    }

    addNarrativeSheet(workbook: Workbook) {
        const { merReport } = this;
        const { config } = this.merReport;
        const title = i18n.t("Monthly Executive Report");
        const now = moment();

        const rows = [
            [text(title, { font: { bold: true, size: 12 }, alignment: { horizontal: "center" } })],
            [text(merReport.data.date.format("MMMM YYYY"))],
            [text(i18n.t("Country Director") + ": " + merReport.data.countryDirector)],
            [text(i18n.t("Prepared by") + ": " + config.currentUser.displayName)],
            [text(now.format("LL"))],
            [],
            [bold(i18n.t("Executive Summary"))],
            [text(merReport.data.executiveSummary, { height: 50 })],
            [],
            [bold(i18n.t("Ministry Summary"))],
            [text(merReport.data.ministrySummary, { height: 50 })],
            [],
            [bold(i18n.t("Staff Summary"))],
            [],
            ...insertColumns(getStaffSummary(merReport), 1),
            [],
            [bold(i18n.t("Projected Activities for the Next Month"))],
            [text(merReport.data.projectedActivitiesNextMonth, { height: 50 })],
        ];

        const sheet = addWorkSheet(workbook, i18n.t("Narrative"), rows);

        _.range(1, sheet.columnCount + 1).forEach(
            columnIndex => (sheet.getColumn(columnIndex).width = 15)
        );
    }

    addActivitesSheet(workbook: Workbook) {
        const { merReport } = this;

        const dataRows: Row[] = _.flatMap(merReport.data.projectsData, project => {
            return project.dataElements.map(de => {
                return [
                    text(`${project.name} (${project.dateInfo})`),
                    text(de.name),
                    float(de.target),
                    float(de.actual),
                    float(de.achieved),
                    text(de.comment),
                ];
            });
        });
        const columns = [
            header(i18n.t("Project"), { width: 40 }),
            header(i18n.t("Indicators"), { width: 60 }),
            header(i18n.t("Target"), { width: 10, isNumber: true }),
            header(i18n.t("Actual"), { width: 10, isNumber: true }),
            header(i18n.t("Achieved to date (%)"), { width: 10, isNumber: true }),
            header(i18n.t("Comment"), { width: 50, center: false }),
        ];

        const sheet = addWorkSheet(workbook, i18n.t("Activities"), dataRows, { columns });
        sheet.getRow(1).font = { bold: true };
        return sheet;
    }
}

function header(
    name: string,
    {
        width,
        isNumber = false,
        center = true,
    }: { width: number; isNumber?: boolean; center?: boolean }
): Partial<Column> {
    return {
        header: name,
        width,
        style: {
            numFmt: isNumber ? "0.00" : undefined,
            ...(center ? { alignment: { horizontal: "center" } } : {}),
        },
    };
}

function addWorkSheet(
    workbook: Workbook,
    name: string,
    rows: Row[],
    options: { columns?: Partial<Column>[] } = {}
): Worksheet {
    const sheet = workbook.addWorksheet(name);
    if (options.columns) sheet.columns = options.columns;

    const sheetRows: CellValue[][] = rows.map(row => row.map(cell => cell.value));
    sheet.addRows(sheetRows);
    applyStyles(sheet, rows);
    return sheet;
}

function applyStyles(sheet: Worksheet, rows: Row[]): void {
    rows.forEach((row, rowIndex) => {
        if (row.length === 1) {
            sheet.mergeCells({ top: rowIndex + 1, left: 1, bottom: rowIndex + 1, right: 6 });
        }

        row.forEach((cell, columnIndex) => {
            if (cell.alignment) {
                sheet.getCell(rowIndex + 1, columnIndex + 1).alignment = cell.alignment;
            }
            if (cell.font) {
                sheet.getCell(rowIndex + 1, columnIndex + 1).font = cell.font;
            }
        });

        const maxHeight = _(row)
            .map(cell => cell.height)
            .compact()
            .max();
        if (maxHeight) sheet.getRow(rowIndex + 1).height = maxHeight;
    });
}

function getStaffSummary(report: MerReport): Row[] {
    const f = float;
    const translations = getStaffTranslations();
    const valuesList = staffKeys.map(staffKey => {
        const staff = report.data.staffSummary[staffKey];
        const total = staff.fullTime + staff.partTime;
        return { key: staffKey, values: { ...staff, total } };
    });
    const totalFullTime = _(valuesList)
        .map(({ values }) => values.fullTime)
        .sum();
    const totalPartTime = _(valuesList)
        .map(({ values }) => values.partTime)
        .sum();

    return [
        [text(""), bold(i18n.t("Full-time")), bold(i18n.t("Part-time")), bold(i18n.t("Total"))],
        ...valuesList.map(({ key, values }) => {
            return [
                italic(translations[key]),
                f(values.fullTime),
                f(values.partTime),
                f(values.total),
            ];
        }),
        [
            bold(i18n.t("Total")),
            f(totalFullTime),
            f(totalPartTime),
            f(totalFullTime + totalPartTime),
        ],
    ];
}

function float(n: number | undefined): Value {
    return { type: "number", value: n || 0.0 };
}

function insertColumns(rows: Row[], count: number): Row[] {
    const newColumns = _.times(count).map(_i => text(""));
    return rows.map(row => [...newColumns, ...row]);
}

function text(s: string, options: Omit<TextValue, "type" | "value"> = {}): Value {
    return { type: "text", value: s, ...options };
}

function bold(s: string): Value {
    return text(s, { font: { bold: true, size: 10 } });
}

function italic(s: string): Value {
    return text(s, { font: { italic: true, size: 10 } });
}

export default MerReportSpreadsheet;

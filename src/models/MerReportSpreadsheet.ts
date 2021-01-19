import ExcelJS, { CellValue, Font, Alignment, Worksheet, Workbook, Column } from "exceljs";
import _ from "lodash";
import "../utils/lodash-mixins";
import moment from "moment";
import MerReport, { staffKeys, getStaffTranslations } from "./MerReport";
import i18n from "../locales";
import { cell } from "../utils/spreadsheets";

type Value = TextValue | NumberValue | FormulaValue;

type Row = Value[];

type GetFormulaValue = (relativeColumn: number, relativeRow: number) => string;

interface ValueBase {
    font?: Partial<Font>;
    alignment?: Partial<Alignment>;
    height?: number;
    colspan?: number;
}

interface NumberValue extends ValueBase {
    type: "number";
    value: number | "";
}

interface TextValue extends ValueBase {
    type: "text";
    value: string;
}

interface FormulaValue extends ValueBase {
    type: "formula";
    value: GetFormulaValue;
}

const defaultFont: Partial<Font> = {
    name: "Times New Roman",
    size: 12,
};

class MerReportSpreadsheet {
    constructor(public merReport: MerReport) {}

    async generate(): Promise<{ buffer: ExcelJS.Buffer; filename: string }> {
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

        const buffer = await workbook.xlsx.writeBuffer();
        const orgUnitName = organisationUnit.displayName;
        const filename = ["MER", orgUnitName, date.format("YYYY_MM")].join("-") + ".xlsx";
        return { filename, buffer };
    }

    addNarrativeSheet(workbook: Workbook) {
        const { config } = this.merReport;
        const { merReport } = this;
        const {
            date,
            organisationUnit,
            countryDirector,
            projectedActivitiesNextMonth,
        } = merReport.data;
        const countryName = organisationUnit.displayName;
        const title = i18n.t("Monthly Executive Report") + " - " + countryName;
        const now = moment();

        const rows = [
            [
                text(title, {
                    colspan: 6,
                    font: { bold: true, size: 13 },
                    alignment: { horizontal: "center" },
                }),
            ],
            [text(date.format("MMMM YYYY"), { colspan: 6 })],
            [text(i18n.t("Country Director") + ": " + countryDirector, { colspan: 6 })],
            [text(i18n.t("Prepared by") + ": " + config.currentUser.displayName, { colspan: 6 })],
            [text(now.format("LL"), { colspan: 6 })],
            [],
            [bold(i18n.t("Executive Summary"), { colspan: 6 })],
            ...merReport
                .getExecutiveSummaries()
                .map(({ sector, value }) => [
                    text(sector.displayName),
                    text(value, { colspan: 5 }),
                ]),
            [],
            [bold(i18n.t("Ministry Summary"), { colspan: 6 })],
            [text(merReport.data.ministrySummary, { colspan: 6 })],
            [],
            [bold(i18n.t("Staff Summary"), { colspan: 6 })],
            [],
            ...insertColumns(getStaffSummary(merReport), 1),
            [],
            [bold(i18n.t("Projected Activities for the Next Month"), { colspan: 6 })],
            [text(projectedActivitiesNextMonth, { colspan: 6 })],
            [],
            [bold(i18n.t("Additional comments"), { colspan: 6 })],
            [text(merReport.data.additionalComments, { colspan: 6 })],
            [],
        ];

        const sheet = addWorkSheet(workbook, this.getTabName(i18n.t("Narrative")), rows);

        _.range(1, sheet.columnCount + 1).forEach(
            columnIndex => (sheet.getColumn(columnIndex).width = 15)
        );
    }

    addActivitesSheet(workbook: Workbook) {
        const { merReport } = this;
        const dataElementsMER = merReport.getData();

        const dataRows: Row[] = dataElementsMER.map(de => {
            const { project } = de;
            return [
                text(de.locations.map(location => location.name).join(", ")),
                text(`#${project.code} ${project.name}`),
                text(project.dateInfo),
                text(de.code),
                text(de.name),
                float(de.target.onlyApproved),
                float(de.actual.onlyApproved),
                float(de.targetAchieved.onlyApproved),
                float(de.actualAchieved.onlyApproved),
                float(de.achieved?.onlyApproved),
                text(de.comment),
            ];
        });

        const columns = [
            header(i18n.t("Locations"), { width: 40, center: true }),
            header(i18n.t("Project"), { width: 40 }),
            header(i18n.t("Dates"), { width: 30 }),
            header(i18n.t("Indicator\ncode"), { width: 10 }),
            header(i18n.t("Indicator name"), { width: 50 }),
            header(i18n.t("Target"), { width: 12, isNumber: true, center: true }),
            header(i18n.t("Actual"), { width: 12, isNumber: true, center: true }),
            header(i18n.t("Target\nto date"), { width: 12, isNumber: true, center: true }),
            header(i18n.t("Actual\nto date"), { width: 12, isNumber: true, center: true }),
            header(i18n.t("Achieved\nto date (%)"), {
                width: 12,
                isNumber: true,
                numberFormat: "integer",
                center: true,
            }),
            header(i18n.t("Comment"), { width: 50 }),
        ];

        const sheet = addWorkSheet(workbook, this.getTabName(i18n.t("Activities")), dataRows, {
            columns,
        });

        mergeConsecutiveRows(sheet, { column: 1 });
        mergeConsecutiveRows(sheet, { column: 2 });

        return sheet;
    }

    private getTabName(name: string): string {
        const { date, organisationUnit } = this.merReport.data;
        const countryName = organisationUnit.displayName;
        return countryName + "-" + name + " " + date.format("MM-YYYY");
    }
}

function mergeConsecutiveRows(sheet: Worksheet, options: { column: number }) {
    const columnIndex = options.column;
    const column = sheet.getColumn(columnIndex);
    const cells: ExcelJS.Cell[] = getColumnCells(column);
    type RowValue = { row: number; value: ExcelJS.CellValue; cell: ExcelJS.Cell };

    _(cells)
        .map((cell): RowValue => ({ row: parseInt(cell.row), value: cell.value, cell }))
        .groupConsecutiveBy(o => o.value)
        .forEach(([_value, objs]) => {
            const [first, last] = [_.first(objs), _.last(objs)];
            if (!first || !last) return;

            sheet.mergeCells({
                top: first.row,
                left: columnIndex,
                bottom: last.row,
                right: columnIndex,
            });

            const firstCell = first.cell;
            firstCell.style = {
                ...firstCell.style,
                alignment: { ...firstCell.style.alignment, vertical: "middle" },
            };
        });
}

interface HeaderOptions {
    width: number;
    isNumber?: boolean;
    center?: boolean;
    numberFormat?: "dynamicDecimals" | "integer";
}

const numFmtByType: Record<NonNullable<HeaderOptions["numberFormat"]>, string | undefined> = {
    dynamicDecimals: undefined,
    integer: "0",
};

function getColumnCells(column: Partial<ExcelJS.Column>) {
    const cells: ExcelJS.Cell[] = [];

    if (column.eachCell) {
        column.eachCell(cell => {
            cells.push(cell);
        });
    }
    return cells;
}

function header(name: string | string[], headerOptions: HeaderOptions): Partial<Column> {
    const {
        width,
        isNumber = false,
        center = false,
        numberFormat = "dynamicDecimals",
    } = headerOptions;

    return {
        header: name,
        width,
        style: {
            numFmt: isNumber ? numFmtByType[numberFormat] : undefined,
            ...(center ? { alignment: { horizontal: "center", vertical: "middle" } } : {}),
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

    const sheetRows: CellValue[][] = rows.map((row, rowIdx) =>
        row.map((cell, colIdx) =>
            cell.type === "formula"
                ? { formula: cell.value(rowIdx, colIdx), date1904: false }
                : cell.value
        )
    );
    sheet.addRows(sheetRows);
    applyStyles(sheet, rows, { hasColumns: !!options.columns });
    return sheet;
}

function applyStyles(sheet: Worksheet, rows: Row[], options: { hasColumns: boolean }): void {
    const rowOffset = options.hasColumns ? 2 : 1;

    // Data rows
    rows.forEach((row, rowIndex) => {
        row.forEach((cell, columnIndex) => {
            const iRow = rowIndex + rowOffset;
            const sheetCell = sheet.getCell(iRow, columnIndex + 1);

            if (cell.colspan) {
                const left = columnIndex + 1;
                sheet.mergeCells({
                    top: iRow,
                    left,
                    bottom: iRow,
                    right: left + cell.colspan - 1,
                });
            }

            if (cell.type === "text") {
                const nLines = cell.value.trim().split(/\n/).length;
                if (nLines > 1) {
                    cell.height = 14 * nLines;
                }
            }

            sheetCell.alignment = { ...sheetCell.alignment, vertical: "top", ...cell.alignment };

            if (cell.font) {
                sheetCell.font = cell.font;
            }

            sheetCell.font = { ...defaultFont, ...sheetCell.font };
        });

        const maxHeight = _(row)
            .map(cell => cell.height)
            .compact()
            .max();

        if (maxHeight) sheet.getRow(rowIndex + 1).height = maxHeight;

        if (options.hasColumns) {
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, ...defaultFont };
            applyHeaderStyles(headerRow);
        }
    });
}

function applyHeaderStyles(headerRow: ExcelJS.Row) {
    const cells = _(1)
        .range(headerRow.actualCellCount + 1)
        .map(idx => headerRow.getCell(idx));

    const nLines =
        cells
            .map(
                cell =>
                    (cell.value || "")
                        .toString()
                        .trim()
                        .split(/\n/).length
            )
            .max() || 0;

    if (nLines > 1) {
        headerRow.height = 14 * nLines;
    }

    cells.forEach(cell => {
        cell.style = { ...cell.style, alignment: { horizontal: "center", vertical: "middle" } };
    });
}

function getStaffSummary(report: MerReport): Row[] {
    const translations = getStaffTranslations();
    const valuesList = staffKeys.map(staffKey => {
        const staff = _(report.data.staffSummary).get(staffKey, null);
        return { key: staffKey, values: staff };
    });

    const sumOfPrevious2Rows = formula((row, col) =>
        ["SUM(", cell(col - 2, row), ":", cell(col - 1, row), ")"].join("")
    );

    const sumOfPreviousStaffColumns = formula((row, col) =>
        ["SUM(", cell(col, row - staffKeys.length), ":", cell(col, row - 1), ")"].join("")
    );

    return [
        [
            text(""),
            bold(i18n.t("Full-time"), { alignment: { horizontal: "center" } }),
            bold(i18n.t("Part-time"), { alignment: { horizontal: "center" } }),
            bold(i18n.t("Total"), { alignment: { horizontal: "center" } }),
        ],
        ...valuesList.map(({ key, values }) => {
            return [
                italic(translations[key]),
                float(values ? values.fullTime : null),
                float(values ? values.partTime : null),
                sumOfPrevious2Rows,
            ];
        }),
        [
            bold(i18n.t("Total")),
            sumOfPreviousStaffColumns,
            sumOfPreviousStaffColumns,
            sumOfPrevious2Rows,
        ],
    ];
}

function insertColumns(rows: Row[], count: number): Row[] {
    const newColumns = _.times(count).map(_i => text(""));
    return rows.map(row => [...newColumns, ...row]);
}

type Options = Omit<TextValue, "type" | "value">;

function formula(value: GetFormulaValue, options: Options = {}): FormulaValue {
    return { type: "formula", value, ...options };
}

function float(n: number | null | undefined, options: Options = {}): Value {
    return { type: "number", value: _.isNil(n) ? "" : n, ...options };
}

function text(s: string, options: Options = {}): Value {
    return { type: "text", value: s, ...options };
}

function bold(s: string, options: Options = {}): Value {
    return text(s, { font: { bold: true }, ...options });
}

function italic(s: string, options: Options = {}): Value {
    return text(s, { font: { italic: true }, ...options });
}

export default MerReportSpreadsheet;

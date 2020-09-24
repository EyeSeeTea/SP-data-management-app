import _ from "lodash";
import ExcelJS, { CellValue, Font, Alignment, Worksheet, Workbook, Column, Fill } from "exceljs";
import moment, { Moment } from "moment";

import { Config } from "./Config";
import Project from "./Project";
import i18n from "../locales";
import ProjectAnalytics from "./ProjectAnalytics";
import { cell } from "../utils/spreadsheets";

type Value = TextValue | NumberValue | FormulaValue;

type Row = Value[];

interface ValueBase {
    font?: Partial<Font>;
    alignment?: Partial<Alignment>;
    height?: number;
    merge?: [number, number];
    numFmt?: string;
    fill?: Fill;
}

interface NumberValue extends ValueBase {
    type: "number";
    value: number;
}

interface TextValue extends ValueBase {
    type: "text";
    value: string;
}

interface FormulaValue extends ValueBase {
    type: "formula";
    value: GetFormulaValue;
}

type Period = { id: string; date: Moment };

const defaultFont: Partial<Font> = {
    name: "Times New Roman",
    size: 12,
};

const percentage = "0.00%";

const baseStyle: Fill = {
    type: "pattern",
    pattern: "lightTrellis",
    fgColor: { argb: "FF000000" },
};

const fills = {
    target: { ...baseStyle, bgColor: { argb: "FFe1efda" } },
    actual: { ...baseStyle, bgColor: { argb: "FFfff2ce" } },
    cumulative: { ...baseStyle, bgColor: { argb: "FFd7e2f2" } },
    targetBenefit: { ...baseStyle, bgColor: { argb: "FFececec" } },
};

class ProjectDownload {
    config: Config;
    periods: Array<Period>;

    constructor(public project: Project) {
        this.config = project.config;
        this.periods = project.getPeriods();
    }

    async generate(): Promise<{ buffer: ExcelJS.Buffer; filename: string }> {
        const now = moment();
        const workbook = new ExcelJS.Workbook();
        const { config } = this;

        workbook.creator = this.config.currentUser.displayName;
        workbook.lastModifiedBy = this.config.currentUser.displayName;
        workbook.created = now.toDate();
        workbook.modified = now.toDate();

        const [peopleAnalytics, benefitAnalytics] = await Promise.all([
            ProjectAnalytics.build(this.project, [
                config.categories.targetActual,
                config.categories.newRecurring,
                config.categories.gender,
            ]),
            ProjectAnalytics.build(this.project, [config.categories.targetActual]),
        ]);

        this.addBenefitSheet(workbook, benefitAnalytics);
        this.addPeopleSheet(workbook, peopleAnalytics);

        const buffer = await workbook.xlsx.writeBuffer();
        const filename = `Activity Monitoring - ${this.project.name}.xlsx`;
        return { filename, buffer };
    }

    addBenefitSheet(workbook: Workbook, analytics: ProjectAnalytics) {
        const { project } = this;
        const { config } = project;
        const title = [project.name, i18n.t("ACTIVITY MONITORING"), i18n.t("BENEFIT")].join(" - ");
        const periods = project.getPeriods();
        const dataElements = uniq(project.getSelectedDataElements({ peopleOrBenefit: "benefit" }));
        const empty = text("");

        const cumulativeRow = formula(
            (row, col) =>
                ["SUM(", cell(col - periods.length, row), ":", cell(col - 1, row), ")"].join(""),
            { fill: fills.cumulative }
        );

        const dataRows: Row[] = _.flatMap(dataElements, (dataElement, index) => {
            return [
                [
                    header((index + 1).toString(), {
                        merge: [1, 3],
                        alignment: { vertical: "middle" },
                    }),
                    header(dataElement.code, { merge: [1, 3], alignment: { vertical: "middle" } }),
                    text(dataElement.name, { merge: [1, 3], alignment: { vertical: "middle" } }),
                    header(i18n.t("% Achievement to Date"), {
                        merge: [periods.length + 1, 1],
                        alignment: { horizontal: "right" },
                        fill: fills.cumulative,
                    }),
                    ...periods.map(_date => text("")),
                    formula(
                        (rowIdx, colIdx) =>
                            [cell(colIdx, rowIdx + 2), "/", cell(colIdx, rowIdx + 1)].join(""),
                        { numFmt: percentage, fill: fills.cumulative, font: { bold: true } }
                    ),
                    text("", { merge: [1, 3] }), // Method
                    text("", { merge: [1, 3] }), // Responsible
                ],
                [
                    ...repeat(empty, 3),
                    header(i18n.t("Target Benefit"), { fill: fills.targetBenefit }),
                    ...this.mapPeriods(
                        period =>
                            analytics.get(dataElement, period.id, [config.categoryOptions.target]),
                        { fill: fills.targetBenefit }
                    ),
                    cumulativeRow,
                ],
                [
                    ...repeat(empty, 3),
                    header(i18n.t("Actual Benefit")),
                    ...this.mapPeriods(period =>
                        analytics.get(dataElement, period.id, [config.categoryOptions.actual])
                    ),
                    cumulativeRow,
                ],
            ];
        });

        const rows = [
            [
                text(title, {
                    merge: [periods.length + 5, 1],
                    font: { bold: true, size: 13 },
                    alignment: { horizontal: "center" },
                }),
            ],
            [
                header("#"),
                header(i18n.t("Indicator Code")),
                header(i18n.t("Activity Indicator")),
                header(i18n.t("Data Type")),
                ...periods.map(period => header(period.date.format("MMM-YY"))),
                header(i18n.t("Cumulative"), { fill: fills.cumulative }),
                header(i18n.t("Method of Data Collection")),
                header(i18n.t("Person Responsible")),
            ],
            ...dataRows,
        ];

        const sheet = addWorkSheet(workbook, i18n.t("Benefit"), rows);
        const columnWidths = [1, 2, 5, 3, ...periods.map(_date => 1), 2, 4, 4];
        columnWidths.forEach((width, colIdx) => {
            sheet.getColumn(colIdx + 1).width = width * 7.5;
        });

        return sheet;
    }

    addPeopleSheet(workbook: Workbook, analytics: ProjectAnalytics) {
        const { project, periods } = this;
        const { config } = project;
        const title = [project.name, i18n.t("ACTIVITY MONITORING"), i18n.t("PEOPLE")].join(" - ");
        const dataElements = uniq(project.getSelectedDataElements({ peopleOrBenefit: "people" }));
        const empty = text("");

        const sumRowFormula = formula(
            (row, col) =>
                ["SUM(", cell(col - periods.length, row), ":", cell(col - 1, row), ")"].join(""),
            { fill: fills.cumulative }
        );

        // target header+data (1 + 4) + achievement (1) + actual header+data (1 + 4)
        const rowsCountByDataElement = 11;

        const dataRows: Row[] = _.flatMap(dataElements, (dataElement, index) => {
            return [
                [
                    header((index + 1).toString(), {
                        merge: [1, rowsCountByDataElement],
                        alignment: { vertical: "middle" },
                    }),
                    header(dataElement.code, {
                        merge: [1, rowsCountByDataElement],
                        alignment: { vertical: "middle" },
                    }),
                    text("", { merge: [1, rowsCountByDataElement] }),
                    text(dataElement.name, {
                        merge: [1, rowsCountByDataElement],
                        alignment: { vertical: "middle" },
                    }),
                    header(i18n.t("Total People Targeted"), { fill: fills.target }),
                    ...this.mapPeriods(
                        period =>
                            analytics.get(dataElement, period.id, [
                                config.categoryOptions.target,
                                config.categoryOptions.new,
                            ]),
                        { font: { bold: true }, fill: fills.target }
                    ),
                    { ...sumRowFormula },
                    text("", { merge: [1, 5] }), // Method
                    text("", { merge: [1, 5] }), // Responsible
                ],
                [
                    ...repeat(empty, 4),
                    text(i18n.t("Male New"), {
                        fill: fills.target,
                        alignment: { horizontal: "right" },
                    }),
                    ...this.mapPeriods(period =>
                        analytics.get(dataElement, period.id, [
                            config.categoryOptions.target,
                            config.categoryOptions.new,
                            config.categoryOptions.male,
                        ])
                    ),
                    sumRowFormula,
                ],
                [
                    ...repeat(empty, 4),
                    text(i18n.t("Female New"), {
                        fill: fills.target,
                        alignment: { horizontal: "right" },
                    }),
                    ...this.mapPeriods(period =>
                        analytics.get(dataElement, period.id, [
                            config.categoryOptions.target,
                            config.categoryOptions.new,
                            config.categoryOptions.female,
                        ])
                    ),
                    sumRowFormula,
                ],
                [
                    ...repeat(empty, 4),
                    text(i18n.t("Male Returning"), {
                        fill: fills.target,
                        alignment: { horizontal: "right" },
                    }),
                    ...this.mapPeriods(period =>
                        analytics.get(dataElement, period.id, [
                            config.categoryOptions.target,
                            config.categoryOptions.recurring,
                            config.categoryOptions.male,
                        ])
                    ),
                    sumRowFormula,
                ],
                [
                    ...repeat(empty, 4),
                    text(i18n.t("Female Returning"), {
                        fill: fills.target,
                        alignment: { horizontal: "right" },
                    }),
                    ...this.mapPeriods(period =>
                        analytics.get(dataElement, period.id, [
                            config.categoryOptions.target,
                            config.categoryOptions.recurring,
                            config.categoryOptions.female,
                        ])
                    ),
                    sumRowFormula,
                ],
                [
                    ...repeat(empty, 4),
                    header(i18n.t("% Achievement to Date"), {
                        merge: [periods.length + 1, 1],
                        alignment: { horizontal: "right" },
                        fill: fills.cumulative,
                    }),
                    ...repeat(empty, periods.length),
                    formula(
                        (rowIdx, colIdx) =>
                            [cell(colIdx, rowIdx + 1), "/", cell(colIdx, rowIdx - 5)].join(""),
                        { numFmt: percentage, fill: fills.cumulative, font: { bold: true } }
                    ),
                    text("", { merge: [1, 6] }), // Method
                    text("", { merge: [1, 6] }), // Responsible
                ],
                [
                    ...repeat(empty, 4),
                    header(i18n.t("Total Actual People"), { fill: fills.actual }),
                    ...this.mapPeriods(
                        period =>
                            analytics.get(dataElement, period.id, [
                                config.categoryOptions.actual,
                                config.categoryOptions.new,
                            ]),
                        { fill: fills.actual }
                    ),
                    sumRowFormula,
                ],
                [
                    ...repeat(empty, 4),
                    text(i18n.t("Male New"), { alignment: { horizontal: "right" } }),
                    ...this.mapPeriods(period =>
                        analytics.get(dataElement, period.id, [
                            config.categoryOptions.actual,
                            config.categoryOptions.new,
                            config.categoryOptions.male,
                        ])
                    ),
                    sumRowFormula,
                ],
                [
                    ...repeat(empty, 4),
                    text(i18n.t("Female New"), { alignment: { horizontal: "right" } }),
                    ...this.mapPeriods(period =>
                        analytics.get(dataElement, period.id, [
                            config.categoryOptions.actual,
                            config.categoryOptions.new,
                            config.categoryOptions.female,
                        ])
                    ),
                    sumRowFormula,
                ],
                [
                    ...repeat(empty, 4),
                    text(i18n.t("Male Returning"), { alignment: { horizontal: "right" } }),
                    ...this.mapPeriods(period =>
                        analytics.get(dataElement, period.id, [
                            config.categoryOptions.actual,
                            config.categoryOptions.recurring,
                            config.categoryOptions.male,
                        ])
                    ),
                    sumRowFormula,
                ],
                [
                    ...repeat(empty, 4),
                    text(i18n.t("Female Returning"), { alignment: { horizontal: "right" } }),
                    ...this.mapPeriods(period =>
                        analytics.get(dataElement, period.id, [
                            config.categoryOptions.actual,
                            config.categoryOptions.recurring,
                            config.categoryOptions.female,
                        ])
                    ),
                    sumRowFormula,
                ],
            ];
        });

        const rows = [
            [
                text(title, {
                    merge: [periods.length + 5, 1],
                    font: { bold: true, size: 13 },
                    alignment: { horizontal: "center" },
                }),
            ],
            [
                header("#"),
                header(i18n.t("Indicator Code")),
                header(i18n.t("Counting Method")),
                header(i18n.t("Activity Indicator")),
                header(i18n.t("Data Type")),
                ...periods.map(period => header(period.date.format("MMM-YY"))),
                header(i18n.t("Cumulative"), { fill: fills.cumulative }),
                header(i18n.t("Method of Data Collection")),
                header(i18n.t("Person Responsible")),
            ],
            ...dataRows,
        ];

        const sheet = addWorkSheet(workbook, i18n.t("People"), rows);
        const columnWidths = [1, 2, 2.5, 5, 4, ...periods.map(_date => 1), 2, 4, 4];
        columnWidths.forEach((width, colIdx) => {
            sheet.getColumn(colIdx + 1).width = width * 7.5;
        });

        return sheet;
    }

    mapPeriods(mapper: (period: Period) => number, options?: Options): Value[] {
        return this.periods.map(period => float(mapper(period), options));
    }
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
    applyStyles(sheet, rows);

    return sheet;
}

function applyStyles(sheet: Worksheet, rows: Row[]): void {
    rows.forEach((row, rowIndex) => {
        row.forEach((cellValue, columnIndex) => {
            const cell = sheet.getCell(rowIndex + 1, columnIndex + 1);

            if (cellValue.merge) {
                sheet.mergeCells({
                    top: 1 + rowIndex,
                    left: 1 + columnIndex,
                    bottom: rowIndex + cellValue.merge[1],
                    right: columnIndex + cellValue.merge[0],
                });
            }
            if (cellValue.alignment) cell.alignment = cellValue.alignment;
            if (cellValue.font) cell.font = cellValue.font;
            if (cellValue.numFmt) cell.numFmt = cellValue.numFmt;
            if (cellValue.fill) cell.fill = cellValue.fill;

            cell.font = { ...defaultFont, ...cell.font };
        });

        const maxHeight = _(row)
            .map(cell => cell.height)
            .compact()
            .max();
        if (maxHeight) sheet.getRow(rowIndex + 1).height = maxHeight;
    });
}

function repeat<T>(item: T, numberOfRepeats: number): T[] {
    return _.flatten(_.times(numberOfRepeats, _.constant([item])));
}

type GetFormulaValue = (relativeColumn: number, relativeRow: number) => string;

type Options = Partial<TextValue>;

function formula(value: GetFormulaValue, options?: Options): FormulaValue {
    return { ...options, type: "formula", value };
}

function float(n: number | undefined, options?: Options): Value {
    return { ...options, type: "number", value: n || 0.0 };
}

function text(s: string, options?: Options): Value {
    return { ...options, type: "text", value: s };
}

function header(s: string, options: ValueBase = {}): Value {
    const defaultOptions = {
        font: { bold: true },
        alignment: { horizontal: "center" },
    };
    const allOptions = Object.assign({}, defaultOptions, options);
    return text(s, allOptions);
}

function uniq<T extends { id: string }>(dataElements: T[]): T[] {
    return _.uniqBy(dataElements, de => de.id);
}

export default ProjectDownload;

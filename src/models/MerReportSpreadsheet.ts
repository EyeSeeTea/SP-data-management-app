import XLSX from "xlsx";
import _ from "lodash";
import moment from "moment";
import MerReport, { staffKeys, getStaffTranslations } from "./MerReport";
import i18n from "../locales";
import { getIdFromOrgUnit } from "../utils/dhis2";

type Row = string[];

class MerReportSpreadsheet {
    constructor(public merReport: MerReport) {}

    async generate(): Promise<{ blob: Blob; filename: string }> {
        const { merReport } = this;
        const { date, organisationUnit } = merReport.data;
        const { config } = this.merReport;
        if (!date || !organisationUnit) throw new Error("No data");

        const now = moment();
        const book = XLSX.utils.book_new();
        const title = i18n.t("Monthly Executive Report");

        book.Props = {
            Title: title,
            Author: config.currentUser.displayName,
            CreatedDate: now.toDate(),
        };

        const rows = [
            [title],
            [date.format("MMM YYYY")],
            [i18n.t("Country Director") + ": " + merReport.data.countryDirector],
            [i18n.t("Prepared by") + ": " + config.currentUser.displayName],
            [now.format("LL")],
            [],
            [i18n.t("Executive Summary")],
            [formatText(merReport.data.executiveSummary)],
            [],
            [i18n.t("Ministry Summary")],
            [formatText(merReport.data.ministrySummary)],
            [],
            [i18n.t("Staff Summary")],
            [],
            ...insertColumns(getStaffSummary(merReport), 1),
            [],
            [i18n.t("Projected Activities for the Next Month")],
            [formatText(merReport.data.projectedActivitiesNextMonth)],
        ];
        const sheet = XLSX.utils.aoa_to_sheet(rows);

        const merges = rows.map((row, rowIndex) =>
            row.length === 1 ? { s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 5 } } : null
        );
        sheet["!merges"] = _.compact(merges);

        const sheetName = i18n.t("Narrative");
        book.SheetNames.push(sheetName);
        book.Sheets[sheetName] = sheet;
        const res = XLSX.write(book, { bookType: "xlsx", type: "binary" });
        const blob = new Blob([s2ab(res)], { type: "application/octet-stream" });
        const orgUnitId = getIdFromOrgUnit(organisationUnit);
        const filename = orgUnitId + "-" + date.format("YYYY-MM") + ".xlsx";
        return { filename, blob };
    }
}

function getStaffSummary(report: MerReport): Row[] {
    const f = formatFloat;
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
        ["", i18n.t("Full-time"), i18n.t("Part-time"), i18n.t("Total")],
        ...valuesList.map(({ key, values }) => {
            return [translations[key], f(values.fullTime), f(values.partTime), f(values.total)];
        }),
        [i18n.t("Total"), f(totalFullTime), f(totalPartTime), f(totalFullTime + totalPartTime)],
    ];
}

function formatFloat(n: number): string {
    return n.toFixed(2);
}

function formatText(s: string): string {
    return s.trim() || "-";
}

function insertColumns(rows: Row[], count: number): Row[] {
    const newColumns = _.times(count).map(_i => "");
    return rows.map(row => [...newColumns, ...row]);
}

function s2ab(s: string): ArrayBuffer {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i != s.length; ++i) view[i] = s.charCodeAt(i) & 0xff;
    return buf;
}

export default MerReportSpreadsheet;

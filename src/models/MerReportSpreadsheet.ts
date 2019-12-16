import MerReport from "./MerReport";
import XLSX, { WorkBook } from "xlsx";
import i18n from "../locales";

class MerReportSpreadsheet {
    constructor(public merReport: MerReport) {}

    async generate(): Promise<Blob> {
        const { date, organisationUnit } = this.merReport.data;
        if (!date || !organisationUnit) throw new Error("No data");

        const book = XLSX.utils.book_new();
        const title = i18n.t("Monthly Executive Report");
        book.Props = {
            Title: title,
            Author: "TODO",
            CreatedDate: new Date(),
        };

        book.SheetNames.push(i18n.t("Narrative"));
        var rows = [["hello", "world"]];
        var sheet = XLSX.utils.aoa_to_sheet(rows);
        book.Sheets["Test Sheet"] = sheet;
        const res = XLSX.write(book, { bookType: "xlsx", type: "binary" });
        return new Blob([s2ab(res)], { type: "application/octet-stream" });
    }
}

function s2ab(s: string) {
    var buf = new ArrayBuffer(s.length);
    var view = new Uint8Array(buf);
    for (var i = 0; i != s.length; ++i) view[i] = s.charCodeAt(i) & 0xff;
    return buf;
}

export default MerReportSpreadsheet;

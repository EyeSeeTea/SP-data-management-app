import React, { useState } from "react";
import _ from "lodash";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import { useHistory } from "react-router";
import { History } from "history";
import { DatePicker } from "d2-ui-components";
import MerReport, { MerReportData } from "../../models/MerReport";
import { useAppContext } from "../../contexts/api-context";
import UserOrgUnits from "../../components/org-units/UserOrgUnits";
import { Paper, TextField, Button } from "@material-ui/core";
import { getDevMerReport } from "../../models/dev-project";
import ReportDataTable from "./ReportDataTable";
import StaffTable from "./StaffTable";
import MerReportSpreadsheet from "../../models/MerReportSpreadsheet";

type Path = string;

function goTo(history: History, url: string) {
    history.push(url);
}

function getTranslations() {
    return {
        help: i18n.t(`Help message for MER`),
    };
}

function getLastOrgUnit(paths: Path[]): { path: Path } | null {
    return (
        _(paths)
            .map(path => ({ path }))
            .last() || null
    );
}

const Report: React.FC = () => {
    const history = useHistory();
    const goToLandingPage = () => goTo(history, "/");
    const { api, config, isDev } = useAppContext();
    const translations = getTranslations();
    const [merReport, setMerReport] = useState<MerReport>(
        isDev ? getDevMerReport(api, config) : MerReport.create(api, config, {})
    );

    const { date, organisationUnit } = merReport.data;
    React.useEffect(() => {
        merReport.withProjectsData().then(setMerReport);
    }, [date, organisationUnit]);

    function onChange<Field extends keyof MerReportData>(field: Field, val: MerReportData[Field]) {
        setMerReport(merReport.set(field, val));
    }

    async function download() {
        const blob = await new MerReportSpreadsheet(merReport).generate();
        downloadFile("output.xlsx", blob);
    }

    return (
        <React.Fragment>
            <PageHeader
                title={i18n.t("Monthly Executive Report")}
                help={translations.help}
                onBackClick={goToLandingPage}
            />
            <DatePicker
                label={i18n.t("Date")}
                value={date ? date.toDate() : null}
                onChange={date => onChange("date", date)}
                format="MMMM YYYY"
                views={["year", "month"]}
            />
            {date && (
                <UserOrgUnits
                    onChange={paths => onChange("organisationUnit", getLastOrgUnit(paths))}
                    selected={organisationUnit ? [organisationUnit.path] : []}
                    selectableLevels={[2]}
                />
            )}
            {date && organisationUnit && (
                <React.Fragment>
                    <ReportDataTable merReport={merReport} onChange={setMerReport} />
                    <Paper>
                        <MultilineTextField
                            title={i18n.t("Executive Summary")}
                            value={merReport.data.executiveSummary}
                            onChange={value => onChange("executiveSummary", value)}
                        />
                        <MultilineTextField
                            title={i18n.t("Ministry Summary")}
                            value={merReport.data.ministrySummary}
                            onChange={value => onChange("ministrySummary", value)}
                        />
                        <StaffTable merReport={merReport} onChange={setMerReport} />
                        <MultilineTextField
                            title={i18n.t("Projected Activities for the next month")}
                            value={merReport.data.projectedActivitiesNextMonth}
                            onChange={value => onChange("projectedActivitiesNextMonth", value)}
                        />
                    </Paper>

                    <Button onClick={download} variant="contained">
                        {i18n.t("Download")}
                    </Button>

                    <Button onClick={console.log} variant="contained">
                        {i18n.t("Save")}
                    </Button>
                </React.Fragment>
            )}
        </React.Fragment>
    );
};

function downloadFile(filename: string, blob: Blob): void {
    var element = document.createElement("a");
    element.href = window.URL.createObjectURL(blob);
    element.setAttribute("download", filename);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

const MultilineTextField: React.FC<{
    title: string;
    value: string;
    onChange(value: string): void;
}> = ({ title, value, onChange }) => {
    return (
        <div style={{ marginTop: 10, marginBottom: 10, padding: 10 }}>
            <div style={{ fontSize: "1.1em", color: "grey", marginTop: 10, marginBottom: 10 }}>
                {title}
            </div>

            <TextField
                value={value}
                multiline={true}
                fullWidth={true}
                rows={2}
                onChange={ev => onChange(ev.target.value)}
            />
        </div>
    );
};

export default Report;

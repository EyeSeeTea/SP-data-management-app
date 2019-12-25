import React, { useState } from "react";
import { useHistory } from "react-router";
import { History } from "history";
import { makeStyles } from "@material-ui/core/styles";
import { Paper, Button, LinearProgress } from "@material-ui/core";
import { DatePicker, useSnackbar, ConfirmationDialog } from "d2-ui-components";
import { Moment } from "moment";

import MerReport, { MerReportData } from "../../models/MerReport";
import { useAppContext } from "../../contexts/api-context";
import UserOrgUnits from "../../components/org-units/UserOrgUnits";
import { getDevMerReport } from "../../models/dev-project";
import ReportDataTable from "./ReportDataTable";
import StaffTable from "./StaffTable";
import MerReportSpreadsheet from "../../models/MerReportSpreadsheet";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import ReportTextField from "./ReportTextField";

type Path = string;

function goTo(history: History, url: string) {
    history.push(url);
}

function getTranslations() {
    return {
        help: i18n.t(`Help message for MER`),
    };
}

const MerReportComponent: React.FC = () => {
    const history = useHistory();
    const classes = useStyles();
    const goToLandingPage = () => goTo(history, "/");
    const { api, config, isDev } = useAppContext();
    const translations = getTranslations();
    const snackbar = useSnackbar();
    const initial = isDev ? getDevMerReport() : { date: null, orgUnit: null };
    const [showExitWarning, showExitWarningSet] = useState<boolean>(false);
    const [wasReportModified, wasReportModifiedSet] = useState<boolean>(false);
    const [date, setDate] = useState<Moment | null>(initial.date);
    const [orgUnit, setOrgUnit] = useState<MerReportData["organisationUnit"] | null>(
        initial.orgUnit
    );
    const [merReport, setMerReport_] = useState<MerReport | undefined | null>(null);

    React.useEffect(() => {
        if (date && orgUnit) {
            const selectData = { date, organisationUnit: orgUnit };
            setMerReport_(undefined);
            MerReport.create(api, config, selectData).then(setMerReport_);
        }
    }, [date, orgUnit]);

    const setMerReport = React.useCallback((report: MerReport) => {
        setMerReport_(report);
        wasReportModifiedSet(true);
    }, []);

    function onChange<Field extends keyof MerReportData>(field: Field, val: MerReportData[Field]) {
        if (merReport) {
            setMerReport(merReport.set(field, val));
        }
    }

    async function download() {
        if (!merReport) return;
        const { filename, blob } = await new MerReportSpreadsheet(merReport).generate();
        downloadFile(filename, blob);
    }

    async function save() {
        if (!merReport) return;
        try {
            await merReport.save();
            snackbar.success(i18n.t("Report saved"));
            wasReportModifiedSet(false);
        } catch (err) {
            snackbar.error(i18n.t("Error saving report") + ": " + err.message || err.toString());
        }
    }

    return (
        <React.Fragment>
            <ConfirmationDialog
                isOpen={showExitWarning}
                onSave={goToLandingPage}
                onCancel={() => showExitWarningSet(false)}
                title={i18n.t("Monthly Executive Report")}
                description={i18n.t(
                    "You are about to exit the report, any changes will be lost. Are you sure you want to proceed?"
                )}
                saveText={i18n.t("Yes")}
                cancelText={i18n.t("No")}
            />
            <PageHeader
                title={i18n.t("Monthly Executive Report")}
                help={translations.help}
                onBackClick={() =>
                    wasReportModified ? showExitWarningSet(true) : goToLandingPage()
                }
            />
            <Paper style={{ marginBottom: 20 }}>
                <DatePicker
                    label={i18n.t("Date")}
                    value={date ? date.toDate() : null}
                    onChange={setDate}
                    format="MMMM YYYY"
                    views={["year", "month"]}
                    style={{ marginLeft: 20 }}
                />
                <UserOrgUnits
                    onChange={orgUnit => setOrgUnit(orgUnit)}
                    selected={orgUnit}
                    selectableLevels={[2]}
                    withElevation={false}
                    height={200}
                />
            </Paper>

            {merReport === undefined && <LinearProgress />}

            {merReport && !merReport.hasProjects() && (
                <div>{i18n.t("No open projects in the selected date and organisation unit")}</div>
            )}

            {merReport && merReport.hasProjects() && (
                <React.Fragment>
                    <ReportDataTable merReport={merReport} onChange={setMerReport} />

                    <Paper>
                        <ReportTextField
                            title={i18n.t("Executive Summary")}
                            value={merReport.data.executiveSummary}
                            onBlurChange={value => onChange("executiveSummary", value)}
                        />

                        <ReportTextField
                            title={i18n.t("Ministry Summary")}
                            value={merReport.data.ministrySummary}
                            onBlurChange={value => onChange("ministrySummary", value)}
                        />

                        <StaffTable merReport={merReport} onChange={setMerReport} />

                        <ReportTextField
                            title={i18n.t("Projected Activities for the next month")}
                            value={merReport.data.projectedActivitiesNextMonth}
                            onBlurChange={value => onChange("projectedActivitiesNextMonth", value)}
                        />

                        <ReportTextField
                            title={i18n.t("Country Director")}
                            value={merReport.data.countryDirector}
                            onBlurChange={value => onChange("countryDirector", value)}
                            multiline={false}
                        />

                        <div className={classes.buttonsWrapper}>
                            <Button onClick={download} variant="contained">
                                {i18n.t("Download")}
                            </Button>

                            <Button
                                onClick={save}
                                variant="contained"
                                className={classes.saveButton}
                            >
                                {i18n.t("Save")}
                            </Button>
                        </div>
                    </Paper>
                </React.Fragment>
            )}
        </React.Fragment>
    );
};

const useStyles = makeStyles({
    buttonsWrapper: {
        padding: 5,
        marginLeft: 30,
    },
    saveButton: {
        margin: 10,
        backgroundColor: "#2b98f0",
        color: "white",
    },
});

function downloadFile(filename: string, blob: Blob): void {
    const element = document.createElement("a");
    element.href = window.URL.createObjectURL(blob);
    element.setAttribute("download", filename);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

export default MerReportComponent;

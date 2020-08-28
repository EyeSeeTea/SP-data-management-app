import React, { useState } from "react";
import _ from "lodash";
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
import { downloadFile } from "../../utils/download";
import { useBoolean } from "../../utils/hooks";

function goTo(history: History, url: string) {
    history.push(url);
}

function getTranslations() {
    return {
        help: i18n.t(`Please choose the month of data you wish to extract for the MER report.
        Please make sure you choose your country for reporting.

        Note- when you click the date and location, the data will automatically populate.  Please add comments to the data as necessary, and complete the blank sections of the MER each month.
        Download- when you click the “Download” button, the MER will be downloaded to Excel.

        Save- when you click the "Save" button, the MER will automatically be stored in Platform. You can access previous MERs by clicking your country and month of reporting.`),
    };
}

type ProceedWarning = { type: "hidden" } | { type: "visible"; action: () => void };

const MerReportComponent: React.FC = () => {
    const history = useHistory();
    const classes = useStyles();
    const goToLandingPage = () => goTo(history, "/");
    const { api, config, isDev } = useAppContext();
    const translations = getTranslations();
    const snackbar = useSnackbar();
    const initial = isDev ? getDevMerReport() : { date: null, orgUnit: null };
    const [proceedWarning, setProceedWarning] = useState<ProceedWarning>({ type: "hidden" });
    const [wasReportModified, wasReportModifiedSet] = useState(false);
    const datePicker = useBoolean(false);
    const [date, setDate] = useState<Moment | null>(initial.date);
    const [orgUnit, setOrgUnit] = useState<MerReportData["organisationUnit"] | null>(
        initial.orgUnit
    );
    const [merReport, setMerReport_] = useState<MerReport | undefined | null>(null);
    const title = i18n.t("Monthly Executive Reports");

    React.useEffect(() => {
        if (date && orgUnit) {
            const selectData = { date, organisationUnit: orgUnit };
            setMerReport_(undefined);
            wasReportModifiedSet(false);
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
        downloadFile(await new MerReportSpreadsheet(merReport).generate());
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

    function confirmIfUnsavedChanges(action: () => void) {
        if (wasReportModified) {
            setProceedWarning({ type: "visible", action });
        } else {
            action();
        }
    }

    function runProceedAction(action: () => void) {
        setProceedWarning({ type: "hidden" });
        action();
    }

    function setDateAndClosePicker(date: Moment) {
        setDate(date);
        datePicker.disable();
    }

    return (
        <React.Fragment>
            {proceedWarning.type === "visible" && (
                <ConfirmationDialog
                    isOpen={true}
                    onSave={() => runProceedAction(proceedWarning.action)}
                    onCancel={() => runProceedAction(() => {})}
                    title={title}
                    description={i18n.t(
                        "Any changes will be lost. Are you sure you want to proceed?"
                    )}
                    saveText={i18n.t("Yes")}
                    cancelText={i18n.t("No")}
                />
            )}

            <PageHeader
                title={title}
                help={translations.help}
                onBackClick={() => confirmIfUnsavedChanges(goToLandingPage)}
            />

            <Paper style={{ marginBottom: 20 }}>
                <DatePicker
                    open={datePicker.isEnabled}
                    label={i18n.t("Date")}
                    value={date ? date.toDate() : null}
                    onChange={setDateAndClosePicker}
                    format="MMMM YYYY"
                    views={["year", "month"]}
                    style={{ marginLeft: 20 }}
                    onOpen={() => confirmIfUnsavedChanges(() => datePicker.enable())}
                    onClose={() => datePicker.disable()}
                />

                <UserOrgUnits
                    onChange={orgUnit => confirmIfUnsavedChanges(() => setOrgUnit(orgUnit))}
                    selected={orgUnit}
                    selectableLevels={selectableLevels}
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
                        {merReport.getExecutiveSummaries().map(({ sector, value }) => (
                            <ReportTextField
                                key={sector.id}
                                title={i18n.t("Executive Summary") + " - " + sector.displayName}
                                value={value || ""}
                                onBlurChange={newValue =>
                                    onChange("executiveSummaries", {
                                        ...merReport.data.executiveSummaries,
                                        [sector.id]: newValue,
                                    })
                                }
                            />
                        ))}

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
                            title={i18n.t("Additional comments")}
                            value={merReport.data.additionalComments}
                            onBlurChange={value => onChange("additionalComments", value)}
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

const selectableLevels = [2];

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

export default React.memo(MerReportComponent);

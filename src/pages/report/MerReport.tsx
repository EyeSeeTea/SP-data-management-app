import React, { useState } from "react";
import { useHistory } from "react-router";
import { History } from "history";
import { makeStyles } from "@material-ui/core/styles";
import { Paper, Button, LinearProgress } from "@material-ui/core";
import {
    DatePicker,
    useSnackbar,
    ConfirmationDialog,
    useLoading,
} from "@eyeseetea/d2-ui-components";
import { Moment } from "moment";

import MerReport, { MerReportData } from "../../models/MerReport";
import { useAppContext } from "../../contexts/api-context";
import UserOrgUnits, { OrganisationUnit } from "../../components/org-units/UserOrgUnits";
import { getDevMerReport } from "../../models/dev-project";
import ReportDataTable from "./ReportDataTable";
import StaffTable from "./StaffTable";
import MerReportSpreadsheet from "../../models/MerReportSpreadsheet";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import ReportTextField from "./ReportTextField";
import { downloadFile } from "../../utils/download";
import { useBoolean } from "../../utils/hooks";
import { Maybe } from "../../types/utils";
import { withSnackbarOnError } from "../../components/utils/errors";
import ExecutiveSummaries from "../../components/report/ExecutiveSummaries";

type ProceedWarning = { type: "hidden" } | { type: "visible"; action: () => void };

const MerReportComponent: React.FC = () => {
    const { api, config, isDev } = useAppContext();
    const translations = getTranslations();
    const history = useHistory();
    const goToLandingPage = React.useCallback(() => goTo(history, "/"), [history]);
    const classes = useStyles();
    const snackbar = useSnackbar();
    const initial = isDev ? getDevMerReport() : { date: null, orgUnit: null };
    const [proceedWarning, setProceedWarning] = useState<ProceedWarning>({ type: "hidden" });
    const [wasReportModified, wasReportModifiedSet] = useState(false);
    const datePickerState = useBoolean(false);
    const [date, setDate] = useState(initial.date);
    const [orgUnit, setOrgUnit] = useState(initial.orgUnit);
    const [merReport, setMerReportBase] = useState<Maybe<MerReport>>(null);
    const title = i18n.t("Monthly Executive Reports");
    const loading = useLoading();

    React.useEffect(() => {
        if (date && orgUnit) {
            setMerReportBase(undefined);
            wasReportModifiedSet(false);
            const selectData = { date, organisationUnit: orgUnit };
            withSnackbarOnError(snackbar, () =>
                MerReport.create(api, config, selectData).then(setMerReportBase)
            );
        }
    }, [api, config, snackbar, date, orgUnit]);

    const setMerReport = React.useCallback((report: MerReport) => {
        setMerReportBase(report);
        wasReportModifiedSet(true);
    }, []);

    const onChange = React.useCallback(
        <Field extends keyof MerReportData>(field: Field, val: MerReportData[Field]) => {
            if (merReport) {
                setMerReport(merReport.set(field, val));
            }
        },
        [merReport, setMerReport]
    );

    const download = React.useCallback(() => {
        if (merReport) {
            new MerReportSpreadsheet(merReport).generate().then(downloadFile);
        }
    }, [merReport]);

    const save = React.useCallback(() => {
        async function run(merReport: MerReport) {
            try {
                loading.show(true, i18n.t("Saving MER report"));
                await merReport.save();
                snackbar.success(i18n.t("Report saved"));
                wasReportModifiedSet(false);
            } catch (err) {
                const msg = i18n.t("Error saving report") + ": " + err.message || err.toString();
                snackbar.error(msg);
            } finally {
                loading.hide();
            }
        }
        if (merReport) run(merReport);
    }, [merReport, snackbar, wasReportModifiedSet, loading]);

    const confirmIfUnsavedChanges = React.useCallback(
        (action: () => void) => {
            if (wasReportModified) {
                setProceedWarning({ type: "visible", action });
            } else {
                action();
            }
        },
        [wasReportModified, setProceedWarning]
    );

    const runProceedAction = React.useCallback(
        (action: () => void) => {
            setProceedWarning({ type: "hidden" });
            action();
        },
        [setProceedWarning]
    );

    const setDateAndClosePicker = React.useCallback(
        (date: Moment) => {
            setDate(date);
            datePickerState.disable();
        },
        [setDate, datePickerState]
    );

    const saveReportMsg = i18n.t("The report must be saved before it can be downloaded");

    const setOrgUnitConfirmed = React.useCallback(
        (orgUnit: OrganisationUnit) => confirmIfUnsavedChanges(() => setOrgUnit(orgUnit)),
        [confirmIfUnsavedChanges]
    );

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
                    open={datePickerState.isEnabled}
                    label={i18n.t("Date")}
                    value={date ? date.toDate() : null}
                    onChange={setDateAndClosePicker}
                    format="MMMM YYYY"
                    views={["year", "month"]}
                    style={{ marginLeft: 20 }}
                    onOpen={() => confirmIfUnsavedChanges(() => datePickerState.enable())}
                    onClose={() => datePickerState.disable()}
                />

                <UserOrgUnits
                    onChange={setOrgUnitConfirmed}
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
                        <ExecutiveSummaries merReport={merReport} onChange={setMerReport} />

                        <ReportTextField
                            title={i18n.t("Additional comments")}
                            value={merReport.data.additionalComments}
                            field="additionalComments"
                            onBlurChange={onChange}
                        />

                        <ReportTextField
                            title={i18n.t("Ministry Summary")}
                            value={merReport.data.ministrySummary}
                            field="ministrySummary"
                            onBlurChange={onChange}
                        />

                        <StaffTable merReport={merReport} onChange={setMerReport} />

                        <ReportTextField
                            title={i18n.t("Projected Activities for the next month")}
                            value={merReport.data.projectedActivitiesNextMonth}
                            field="projectedActivitiesNextMonth"
                            onBlurChange={onChange}
                        />

                        <ReportTextField
                            title={i18n.t("Country Director")}
                            value={merReport.data.countryDirector}
                            field="countryDirector"
                            onBlurChange={onChange}
                            multiline={false}
                        />

                        <div className={classes.buttonsWrapper}>
                            <Button
                                onClick={save}
                                variant="contained"
                                className={classes.saveButton}
                            >
                                {i18n.t("Save")}
                            </Button>

                            <div
                                title={wasReportModified ? saveReportMsg : undefined}
                                className={classes.downloadButton}
                            >
                                <Button
                                    onClick={download}
                                    variant="contained"
                                    disabled={wasReportModified}
                                >
                                    {i18n.t("Download")}
                                </Button>
                            </div>
                        </div>
                    </Paper>
                </React.Fragment>
            )}
        </React.Fragment>
    );
};

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

const selectableLevels = [2];

const useStyles = makeStyles({
    buttonsWrapper: {
        padding: 5,
        marginLeft: 30,
        paddingBottom: 25,
    },
    saveButton: {
        backgroundColor: "#2b98f0",
        color: "white",
    },
    downloadButton: {
        display: "inline",
        marginLeft: 25,
    },
});

export default React.memo(MerReportComponent);

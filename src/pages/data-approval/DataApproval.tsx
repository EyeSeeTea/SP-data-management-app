import React, { useState, useEffect } from "react";
import moment from "moment";
import { useHistory, useRouteMatch } from "react-router";
import { History } from "history";
import { makeStyles } from "@material-ui/core/styles";
import { Paper, Button, LinearProgress } from "@material-ui/core";
import { DatePicker, useSnackbar, ConfirmationDialog } from "d2-ui-components";
import { Moment } from "moment";
import Dropdown from "../../components/dropdown/Dropdown";
import Project, { DataSet, getPeriodsData } from "../../models/Project";
import { D2Api } from "d2-api";
import { Config } from "../../models/Config";
import _ from "lodash";

// import MerReport, { MerReportData } from "../../models/MerReport";
import { useAppContext } from "../../contexts/api-context";
import UserOrgUnits from "../../components/org-units/UserOrgUnits";
// import { getDevMerReport } from "../../models/dev-project";
// import ReportDataTable from "./ReportDataTable";
// import StaffTable from "./StaffTable";
// import MerReportSpreadsheet from "../../models/MerReportSpreadsheet";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
// import ReportTextField from "./ReportTextField";
import { downloadFile } from "../../utils/download";

const monthFormat = "YYYYMM";

function goTo(history: History, url: string) {
    history.push(url);
}

type Attributes = Record<string, string>;
type RouterParams = { id: string };

type GetState<Data> = { loading: boolean; data?: Data; error?: string };

type State = GetState<{
    name: string;
    orgUnit: { id: string; displayName: string };
    dataSet: DataSet;
}>;

interface DataEntryProps {
    orgUnitId: string;
    dataSet: DataSet;
    attributes: Attributes;
}

function getTranslations() {
    return {
        help: i18n.t(`Data Approval`),
    };
}

const DataApproval: React.FC = () => {
    // const { orgUnitId, dataSet, attributes } = props;
    const match = useRouteMatch<RouterParams>();
    const projectId = match ? match.params.id : null;
    const history = useHistory();
    const classes = useStyles();
    const [state, setState] = useState<State>({ loading: true });
    const goToLandingPage = () => goTo(history, "/");
    const { api, config, isDev } = useAppContext();
    const { data, loading, error } = state;
    const translations = getTranslations();
    const snackbar = useSnackbar();
    // const initial = isDev ? getDevMerReport() : { date: null, orgUnit: null };
    const initial = { date: "", orgUnit: null };
    // const [showExitWarning, showExitWarningSet] = useState<boolean>(false);
    // const [dropdownValue, dropdownValueSet] = useState<boolean>(false);
    const [wasReportModified, wasReportModifiedSet] = useState<boolean>(false);
    const [date, setDate] = useState<string | undefined>(initial.date);
    let periodItems;
    if (data) {
        const { periodIds, currentPeriodId } = getPeriodsData(data.dataSet);
        periodItems = periodIds.map(periodId => ({
            text: moment(periodId, monthFormat).format("MMMM YYYY"),
            value: periodId,
        }));
    }



    // const [orgUnit, setOrgUnit] = useState<MerReportData["organisationUnit"] | null>(
    //     initial.orgUnit
    // );
    // const [merReport, setMerReport_] = useState<MerReport | undefined | null>(null);
    const title = i18n.t("Data Approval");




    useEffect(() => loadData(projectId, api, config, setState), [projectId]);

    return (
        <React.Fragment>
            {/* <ConfirmationDialog
                isOpen={showExitWarning}
                onSave={goToLandingPage}
                onCancel={() => showExitWarningSet(false)}
                title={title}
                description={i18n.t(
                    "You are about to exit the report, any changes will be lost. Are you sure you want to proceed?"
                )}
                saveText={i18n.t("Yes")}
                cancelText={i18n.t("No")}
            /> */}
            <PageHeader
                title={title}
                help={translations.help}
                onBackClick={() => goToLandingPage()}
            />
            <Paper style={{ marginBottom: 20 }}>
                <Dropdown
                    items={periodItems ? periodItems : []}
                    value={date}
                    onChange={setDate}
                    label="Period"
                    hideEmpty={true}
                />
            </Paper>
{/* 
            {merReport === undefined && <LinearProgress />}

            {merReport && !merReport.hasProjects() && (
                <div>{i18n.t("No open projects in the selected date and organisation unit")}</div>
            )}

            {merReport && merReport.hasProjects() && ( */}
            <React.Fragment>Niti</React.Fragment>
            {/* )} */}
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

function loadData(
    projectId: string | null | undefined,
    api: D2Api,
    config: Config,
    setState: React.Dispatch<React.SetStateAction<State>>
) {
    if (!projectId) return;

    Project.get(api, config, projectId)
        .catch(_err => null)
        .then(project => {
            const orgUnit = project ? project.orgUnit : null;
            const dataSet = project && project.dataSets ? project.dataSets["actual"] : null;
            if (project && orgUnit && dataSet) {
                setState({
                    data: { name: project.name, orgUnit, dataSet },
                    loading: false,
                });
            } else {
                setState({ error: i18n.t("Cannot load project relations"), loading: false });
            }
        })
        .catch(err => setState({ error: err.message || err.toString(), loading: false }));
}

export default DataApproval;

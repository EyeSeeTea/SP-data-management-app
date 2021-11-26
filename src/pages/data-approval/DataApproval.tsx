import React, { useState, useEffect, useMemo } from "react";
import moment from "moment";
import { useRouteMatch } from "react-router";
import { makeStyles } from "@material-ui/core/styles";
import { Paper, Button } from "@material-ui/core";
import Dropdown from "../../components/dropdown/Dropdown";
import Project, { getPeriodsData, DataSetType, dataSetTypes } from "../../models/Project";
import { D2Api } from "../../types/d2-api";
import { Config } from "../../models/Config";

import { useAppContext } from "../../contexts/api-context";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import ProjectDataSet from "../../models/ProjectDataSet";
import { isValueInUnionType } from "../../types/utils";
import "./widgets.css";
import { useDialog } from "./data-approval-hooks";
import { DataApprovalMessage } from "./DataApprovalMessage";
import { useAppHistory } from "../../utils/use-app-history";
import { generateUrl } from "../../router";

declare global {
    interface Window {
        jQuery: any;
    }
}

const jQuery = window.jQuery || {};

const monthFormat = "YYYYMM";

type RouterParams = { id: string };

type State = {
    loading: boolean;
    error?: string;
    project?: Project;
    date?: string;
    dataSetType?: DataSetType;
    projectDataSet?: ProjectDataSet;
    report?: string;
    showApproveButton: boolean;
    showUnapproveButton: boolean;
};

const DataApproval: React.FC = () => {
    const { api, config } = useAppContext();
    const match = useRouteMatch<RouterParams>();
    const projectId = match ? match.params.id : null;
    const classes = useStyles();
    const [state, setState] = useState<State>({
        loading: true,
        showApproveButton: false,
        showUnapproveButton: false,
    });

    const appHistory = useAppHistory(generateUrl("projects"));
    const { project, date, dataSetType, projectDataSet, report, error } = state;

    const categoryComboItems = React.useMemo(
        () => [
            { text: i18n.t("Target"), value: "target" },
            { text: i18n.t("Actual"), value: "actual" },
        ],
        []
    );

    const periodItems = React.useMemo(() => {
        if (project && project.dataSets) {
            const { periodIds } = getPeriodsData(project.dataSets["actual"]);
            return periodIds.map(periodId => ({
                text: moment(periodId, monthFormat).format("MMMM YYYY"),
                value: periodId,
            }));
        } else {
            return [];
        }
    }, [project]);

    const title = i18n.t("Data Approval") + (project ? ` - ${project.name}` : "");

    useEffect(() => loadData(projectId, api, config, setState), [api, config, projectId]);
    useEffect(() => getReport(projectDataSet, date, setState), [projectDataSet, date]);

    useDebugValuesOnDev(project, setState);

    const reportHtml = useMemo(() => {
        return { __html: report || "" };
    }, [report]);

    const dataApprovalDialog = useDialog();

    const setDate = React.useCallback(value => setState(prev => ({ ...prev, date: value })), []);

    const setDataSet = React.useCallback(
        dataSetType => {
            if (project && isValueInUnionType(dataSetType, dataSetTypes)) {
                const projectDataSet = project.dataSetsByType[dataSetType];
                setState(prev => ({ ...prev, projectDataSet, dataSetType }));
            }
        },
        [project]
    );

    return (
        <React.Fragment>
            {dataApprovalDialog.isOpen && (
                <DataApprovalMessage
                    onClose={dataApprovalDialog.close}
                    project={project}
                    dataSetType={dataSetType}
                    period={state.date}
                />
            )}
            <PageHeader title={title} help={getHelp()} onBackClick={appHistory.goBack} />
            <Paper style={{ marginBottom: 20, padding: 20 }}>
                <Dropdown
                    items={periodItems}
                    value={date}
                    onChange={setDate}
                    label={i18n.t("Period")}
                    hideEmpty={true}
                />

                <Dropdown
                    items={categoryComboItems ? categoryComboItems : []}
                    value={dataSetType}
                    onChange={setDataSet}
                    label={i18n.t("Actual/Target")}
                    hideEmpty={true}
                />
            </Paper>

            {error && <p>{error}</p>}

            {report && (
                <Paper style={{ marginBottom: 20, padding: 20 }}>
                    <link
                        rel="stylesheet"
                        type="text/css"
                        href={api.baseUrl + "/dhis-web-approval/style/dhis-web-approval.css"}
                    />
                    <link
                        rel="stylesheet"
                        type="text/css"
                        href={api.baseUrl + "/dhis-web-commons/css/light_blue/light_blue.css"}
                    />

                    <div className="page" dangerouslySetInnerHTML={reportHtml}></div>

                    {state.showApproveButton && (
                        <Button
                            onClick={() => approve(date, projectDataSet, setState, true)}
                            variant="contained"
                            className={classes.approveButton}
                        >
                            {i18n.t("Approve")}
                        </Button>
                    )}

                    {state.showUnapproveButton && (
                        <Button
                            onClick={() => approve(date, projectDataSet, setState, false)}
                            variant="contained"
                            className={classes.approveButton}
                        >
                            {i18n.t("Unapprove")}
                        </Button>
                    )}

                    <Button onClick={dataApprovalDialog.open} variant="contained">
                        {i18n.t("Send Message")}
                    </Button>
                </Paper>
            )}
        </React.Fragment>
    );
};

const useStyles = makeStyles({
    approveButton: {
        margin: 10,
        backgroundColor: "#2b98f0",
        color: "white",
    },
});

async function approve(
    date: string | undefined,
    projectDataSet: ProjectDataSet | undefined,
    setState: React.Dispatch<React.SetStateAction<State>>,
    shouldApprove: boolean
) {
    try {
        if (!projectDataSet || !date) return;

        projectDataSet
            .setApprovalState(date, shouldApprove)
            .then(() => {
                setState(state => ({
                    ...state,
                    showApproveButton: !state.showApproveButton,
                    showUnapproveButton: !state.showUnapproveButton,
                }));
            })
            .catch(err =>
                setState({
                    error: err.message || err.toString(),
                    loading: false,
                    showApproveButton: false,
                    showUnapproveButton: false,
                })
            );
    } catch (err) {
        setState({
            error: err.message || err.toString(),
            loading: false,
            showApproveButton: false,
            showUnapproveButton: false,
        });
    }
}

function getReport(
    projectDataSet: ProjectDataSet | undefined,
    date: string | undefined,
    setState: React.Dispatch<React.SetStateAction<State>>
) {
    if (!projectDataSet || !date) return;

    projectDataSet
        .getDataApproval(date)
        .then(catOptComboDataApprovals => {
            if (!catOptComboDataApprovals) {
                setState({
                    error: i18n.t("Cannot load category option combo"),
                    loading: false,
                    showApproveButton: false,
                    showUnapproveButton: false,
                });
                return;
            }

            const showApproveButton =
                catOptComboDataApprovals.permissions.mayApprove &&
                !catOptComboDataApprovals.accepted;

            const showUnapproveButton =
                catOptComboDataApprovals.permissions.mayUnapprove &&
                catOptComboDataApprovals.accepted;

            return projectDataSet.getApprovalForm(date).then(reportData => {
                // Parse report
                const htmlReport = jQuery(jQuery("<div/>").html(reportData));
                htmlReport.find("table.listTable tbody tr:odd").addClass("listAlternateRow");
                htmlReport.find("table.listTable tbody tr:even").addClass("listRow");
                htmlReport.find("#shareForm").hide();
                htmlReport.find("table.listTable tbody tr").mouseover((element: any) => {
                    jQuery(element).addClass("listHoverRow");
                });
                htmlReport.find("table.listTable tbody tr").mouseout((element: any) => {
                    jQuery(element).removeClass("listHoverRow");
                });

                setState(state => ({
                    ...state,
                    date: date,
                    report: htmlReport.html(),
                    loading: false,
                    showApproveButton: showApproveButton,
                    showUnapproveButton: showUnapproveButton,
                }));
            });
        })
        .catch(err =>
            setState({
                error: err.message || err.toString(),
                loading: false,
                showApproveButton: false,
                showUnapproveButton: false,
            })
        );
}

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
            const dataSet = project && project.dataSets ? project.dataSets["actual"] : null;

            if (project && dataSet) {
                setState({
                    project,
                    loading: false,
                    showApproveButton: false,
                    showUnapproveButton: false,
                });
            } else {
                setState({
                    error: i18n.t("Cannot load project relations"),
                    loading: false,
                    showApproveButton: false,
                    showUnapproveButton: false,
                });
            }
        })
        .catch(err =>
            setState({
                error: err.message || err.toString(),
                loading: false,
                showApproveButton: false,
                showUnapproveButton: false,
            })
        );
}

function getHelp(): string {
    return i18n.t(`Please choose the month and type of data (target or actual) you wish to approve.

    Once you approve the data, scroll down to the bottom of the screen and click the blue "Approve" button.`);
}

function useDebugValuesOnDev(
    project: Project | undefined,
    setState: React.Dispatch<React.SetStateAction<State>>
) {
    const { isDev } = useAppContext();
    React.useEffect(() => {
        if (!isDev || !project) return;
        const dataSetType = "actual" as const;
        const projectDataSet = project.dataSetsByType[dataSetType];
        const newState = { date: moment().format(monthFormat), dataSetType, projectDataSet };
        setState(state_ => ({ ...state_, ...newState }));
    }, [isDev, project, setState]);
}

export default React.memo(DataApproval);

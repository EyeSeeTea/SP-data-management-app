import React, { useState, useEffect, useMemo } from "react";
import moment from "moment";
import { useHistory, useRouteMatch } from "react-router";
import { History } from "history";
import { makeStyles } from "@material-ui/core/styles";
import { Paper, Button } from "@material-ui/core";
import Dropdown from "../../components/dropdown/Dropdown";
import Project, { DataSet, getPeriodsData } from "../../models/Project";
import { D2Api, Id } from "d2-api";
import { Config } from "../../models/Config";
import _ from "lodash";

import { useAppContext } from "../../contexts/api-context";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";

declare global {
    interface Window {
        jQuery: any;
    }
}

const jQuery = window.jQuery || {};

const monthFormat = "YYYYMM";

function goTo(history: History, url: string) {
    history.push(url);
}

type RouterParams = { id: string };

type GetState<Data> = {
    loading: boolean;
    error?: string;
    date?: string;
    categoryCombo?: Id;
    data?: Data;
    report?: string;
    showApproveButton: boolean;
    showUnapproveButton: boolean;
};

type State = GetState<DataInterface>;

type CategoryOptionCombosDataApprovals = CategoryOptionComboDataApprovals[];

interface CategoryOptionComboDataApprovals {
    level: Level;
    ou: string;
    permissions: {
        mayApprove: boolean;
        mayUnapprove: boolean;
        mayAccept: boolean;
        mayUnaccept: boolean;
        mayReadData: boolean;
    };
    accepted: boolean;
    id: string;
    ouName: string;
}

type Level = {} | { level: string; id: string };

interface DataInterface {
    name: string;
    orgUnit: { id: string; displayName: string };
    dataSet: DataSet;
    categoryCombos: Array<{ id: Id; displayName: string }>;
}

const DataApproval: React.FC = () => {
    const match = useRouteMatch<RouterParams>();
    const projectId = match ? match.params.id : null;
    const history = useHistory();
    const classes = useStyles();
    const [state, setState] = useState<State>({
        loading: true,
        showApproveButton: false,
        showUnapproveButton: false,
    });
    const goToLandingPage = () => goTo(history, "/");
    const { api, config } = useAppContext();
    const { data, date, categoryCombo, report, error } = state;

    let periodItems;
    let categoryComboItems;
    if (data) {
        const { periodIds } = getPeriodsData(data.dataSet);
        periodItems = periodIds.map(periodId => ({
            text: moment(periodId, monthFormat).format("MMMM YYYY"),
            value: periodId,
        }));
        categoryComboItems = data.categoryCombos.map(categoryCombo => ({
            text: categoryCombo.displayName,
            value: categoryCombo.id,
        }));
    }

    const title = i18n.t("Data Approval");

    useEffect(() => loadData(projectId, api, config, setState), [projectId]);
    useEffect(() => getReport(date, categoryCombo, data, api, setState), [
        data,
        date,
        categoryCombo,
    ]);

    const reportHtml = useMemo(() => {
        return { __html: report || "" };
    }, [report]);

    return (
        <React.Fragment>
            <PageHeader title={title} help={getHelp()} onBackClick={() => goToLandingPage()} />
            <Paper style={{ marginBottom: 20, padding: 20 }}>
                <Dropdown
                    items={periodItems ? periodItems : []}
                    value={date}
                    onChange={value => setState({ ...state, date: value })}
                    label={i18n.t("Period")}
                    hideEmpty={true}
                />

                <Dropdown
                    items={categoryComboItems ? categoryComboItems : []}
                    value={categoryCombo}
                    onChange={value => setState({ ...state, categoryCombo: value })}
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
                        href={api.baseUrl + "/dhis-web-reporting/style/dhis-web-reporting.css"}
                    />
                    <link
                        rel="stylesheet"
                        type="text/css"
                        href={api.baseUrl + "/dhis-web-commons/css/widgets.css"}
                    />
                    <link
                        rel="stylesheet"
                        type="text/css"
                        href={api.baseUrl + "/dhis-web-commons/css/light_blue/light_blue.css"}
                    />

                    <div className="page" dangerouslySetInnerHTML={reportHtml}></div>

                    {state.showApproveButton && (
                        <Button
                            onClick={() => approve(date, categoryCombo, data, api, setState, true)}
                            variant="contained"
                            className={classes.approveButton}
                        >
                            {i18n.t("Approve")}
                        </Button>
                    )}

                    {state.showUnapproveButton && (
                        <Button
                            onClick={() => approve(date, categoryCombo, data, api, setState, false)}
                            variant="contained"
                            className={classes.approveButton}
                        >
                            {i18n.t("Unapprove")}
                        </Button>
                    )}
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
    categoryCombo: Id | undefined,
    data: DataInterface | undefined,
    api: D2Api,
    setState: React.Dispatch<React.SetStateAction<State>>,
    shouldApprove: boolean
) {
    try {
        if (!categoryCombo || !date || !data) return;

        const url = "/dataApprovals/" + (shouldApprove ? "approvals" : "unapprovals");
        const dataSetId = data.dataSet.id;
        const orgUnitId = data.orgUnit.id;

        api.post(
            url,
            {},
            {
                ds: [dataSetId],
                pe: [date],
                approvals: [{ ou: orgUnitId, aoc: categoryCombo }],
            }
        )
            .getData()
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
    date: string | undefined,
    categoryCombo: Id | undefined,
    data: DataInterface | undefined,
    api: D2Api,
    setState: React.Dispatch<React.SetStateAction<State>>
) {
    if (!categoryCombo || !date || !data) return;

    const datasetId = data.dataSet.id;
    const orgUnitId = data.orgUnit.id;
    const params = { ds: datasetId, pe: date, ou: orgUnitId };

    api.get<CategoryOptionCombosDataApprovals>("/dataApprovals/categoryOptionCombos", params)
        .getData()
        .then(response => {
            const categoryOptionCombosDataApprovals = _.filter(response, {
                ou: orgUnitId,
                id: categoryCombo,
            });
            const catOptComboDataApprovals = _(categoryOptionCombosDataApprovals).get(0, null);

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

            // TODO: Move request + html parsing to some model
            return api.baseConnection
                .get("/dhis-web-reporting/generateDataSetReport.action", {
                    params: {
                        ds: datasetId,
                        pe: date,
                        ou: orgUnitId,
                        dimension: "ao:" + categoryCombo,
                    },
                })
                .then(report => {
                    // Parse report
                    const htmlReport = jQuery(jQuery("<div/>").html(report.data));
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
            const orgUnit = project ? project.orgUnit : null;
            const dataSet = project && project.dataSets ? project.dataSets["actual"] : null;
            const categoryCombos =
                project && project.config
                    ? project.config.categoryCombos.targetActual.categoryOptionCombos
                    : null;

            if (project && orgUnit && dataSet && categoryCombos) {
                setState({
                    data: {
                        name: project.name,
                        orgUnit,
                        dataSet,
                        categoryCombos: categoryCombos,
                    },
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

export default DataApproval;

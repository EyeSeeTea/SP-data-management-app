import React from "react";
import { OldObjectsTable } from "d2-ui-components";
import i18n from "../../locales";
import _ from "lodash";
import PageHeader from "../../components/page-header/PageHeader";
import { useHistory } from "react-router";
import { History } from "history";
import { useD2Api } from "../../contexts/api-context";
import { useConfig } from "../../contexts/api-context";
import { generateUrl } from "../../router";
import Project, { FiltersForList, DataSetForList } from "../../models/Project";
import { Pagination } from "../../types/ObjectsList";
import "./ProjectsList.css";

type DataSet = DataSetForList;

function goTo(history: History, url: string) {
    history.push(url);
}

function goToNewProjectPage(history: History) {
    history.push(generateUrl("projects.new"));
}

const Link: React.FC<{ url: string }> = ({ url }) => {
    return (
        <a
            rel="noopener noreferrer"
            style={{ wordBreak: "break-all", textDecoration: "none" }}
            href={url}
            target="_blank"
        >
            {url}
        </a>
    );
};

// to change: use it form api-context
interface MetadataConfig {
    app: string[];
    feedback: string[];
    reportingAnalyst: string[];
    superUser: string[];
    encode: string[];
    analyser: string[];
}

function getConfig({
    history,
    currentUser,
    userRoles,
}: {
    history: History;
    currentUser: string[];
    userRoles: MetadataConfig;
}) {
    const columns = [
        { name: "displayName", text: i18n.t("Name"), sortable: true },
        { name: "publicAccess", text: i18n.t("Public access"), sortable: true },
        { name: "lastUpdated", text: i18n.t("Last updated"), sortable: true },
    ];

    const initialSorting = ["displayName", "asc"];

    const detailsFields = [
        { name: "displayName", text: i18n.t("Name") },
        { name: "displayDescription", text: i18n.t("Description") },
        { name: "created", text: i18n.t("Created") },
        {
            name: "createdBy",
            text: i18n.t("Created By"),
            getValue: (dataSet: DataSet) => `${dataSet.user.displayName} (${dataSet.user.id})`,
        },
        { name: "lastUpdated", text: i18n.t("Last update") },
        { name: "id", text: i18n.t("Id") },
        {
            name: "href",
            text: i18n.t("API link"),
            getValue: function getDataSetLink(dataSet: DataSet) {
                return <Link url={dataSet.href + ".json"} />;
            },
        },
    ];

    // to reduce these const to a self-executing function
    const appRole = _.intersection(currentUser, userRoles.app);
    const feedbackRole = _.intersection(currentUser, userRoles.feedback);
    const reportingAnalystRole = _.intersection(currentUser, userRoles.reportingAnalyst);
    const superUserRole = _.intersection(currentUser, userRoles.superUser);
    const encodeRole = _.intersection(currentUser, userRoles.encode);
    const analyserRole = _.intersection(currentUser, userRoles.analyser);

    const detailsAction = {
        name: "details",
        text: i18n.t("Details"),
        multiple: false,
        type: "details",
        isPrimary: true,
    };

    const dataEntryAction = {
        name: "data-entry",
        icon: "library_books",
        text: i18n.t("Go to Data Entry"),
        multiple: false,
        onClick: (dataSet: DataSet) =>
            history.push(generateUrl("dataEntry.edit", { id: dataSet.id })),
    };

    const dashboardAction = {
        name: "dashboard",
        icon: "dashboard",
        text: i18n.t("Go to Dashboard"),
        multiple: false,
        onClick: () => history.push(generateUrl("dashboard")),
    };

    const targetValuesAction = {
        name: "add-target-values",
        icon: "assignment",
        text: i18n.t("Add Target Values"),
        multiple: false,
    };

    const downloadDataAction = {
        name: "download-data",
        icon: "cloud_download",
        text: i18n.t("Download Data"),
        multiple: false,
    };

    const configMERAction = {
        name: "mer",
        icon: "description",
        text: i18n.t("Generate / Configure MER"),
        multiple: false,
    };

    const createAction = {
        name: "create",
        text: i18n.t("Create"),
        multiple: false,
    };

    const editAction = {
        name: "edit",
        text: i18n.t("Edit"),
        multiple: false,
        // isActive: (d2, dataSet) => true,
        onClick: (dataSet: DataSet) =>
            history.push(generateUrl("projects.edit", { id: dataSet.id })),
    };

    const deleteAction = {
        name: "delete",
        text: i18n.t("Delete"),
        multiple: true,
        onClick: (dataSets: DataSet[]) => {
            console.log("delete", dataSets);
        },
    };

    //To implement:
    // SP Feedback = same behaviour than in vaccination
    // Create Action -> icon

    const getActions = () => {
        if (_.isEqual(appRole, currentUser)) {
            return [
                detailsAction,
                dataEntryAction,
                dashboardAction,
                targetValuesAction,
                downloadDataAction,
                configMERAction,
                editAction,
                deleteAction,
            ];
        } else if (_.isEqual(feedbackRole, currentUser)) {
            return [dashboardAction];
        } else if (_.isEqual(analyserRole, currentUser)) {
            return [dashboardAction, downloadDataAction];
        } else if (_.isEqual(encodeRole, currentUser)) {
            return [dataEntryAction];
        } else if (_.isEqual(superUserRole, currentUser)) {
            return [detailsAction, targetValuesAction, editAction, deleteAction];
        } else if (_.isEqual(reportingAnalystRole, currentUser)) {
            return [targetValuesAction, configMERAction, editAction, deleteAction, createAction];
        } else {
            return [];
        }
    };

    const actions = getActions();

    const help = i18n.t(
        `Click the blue button to create a new project or select a previously created project that you may want to access.

         Click the three dots on the right side of the screen if you wish to perform an action over a project.`
    );

    return { columns, initialSorting, detailsFields, actions, help };
}

const ProjectsList: React.FC = () => {
    const history = useHistory();
    const api = useD2Api();
    const goToLandingPage = () => goTo(history, "/");
    const currentUser = useConfig().currentUser.userRoles;
    const userRoles = useConfig().userRoles;
    const config = getConfig({ history, currentUser, userRoles });

    const list = (_d2: unknown, filters: FiltersForList, pagination: Pagination) =>
        Project.getList(api, filters, pagination);

    return (
        <React.Fragment>
            <PageHeader
                title={i18n.t("Projects")}
                help={config.help}
                onBackClick={goToLandingPage}
            />

            <OldObjectsTable
                model={{ modelValidations: {} }}
                columns={config.columns}
                d2={{}}
                detailsFields={config.detailsFields}
                initialSorting={config.initialSorting}
                pageSize={20}
                actions={config.actions}
                list={list}
                disableMultiplePageSelection={true}
                buttonLabel={i18n.t("Create Project")}
                onButtonClick={() => goToNewProjectPage(history)}
            />
        </React.Fragment>
    );
};

export default ProjectsList;

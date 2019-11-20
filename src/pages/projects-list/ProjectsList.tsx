import React, { useState } from "react";
import { OldObjectsTable } from "d2-ui-components";
import i18n from "../../locales";
import _ from "lodash";
import PageHeader from "../../components/page-header/PageHeader";
import { useHistory } from "react-router";
import { History } from "history";
import { useAppContext, CurrentUser } from "../../contexts/api-context";
import { generateUrl } from "../../router";
import Project, { FiltersForList, DataSetForList } from "../../models/Project";
import { Pagination } from "../../types/ObjectsList";
import "./ProjectsList.css";
import TargetValues from "../../components/TargetValues";
import { Config } from "../../models/config";

type DataSet = DataSetForList;

type ActionsRoleMapping<Actions> = {
    [Key in keyof Config["userRoles"]]?: Array<keyof Actions>;
};

function goTo(history: History, url: string) {
    history.push(url);
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

function getConfig(
    history: History,
    currentUser: CurrentUser,
    setTargetPopulation: React.Dispatch<React.SetStateAction<boolean>>
)  {
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

    const allActions = {
        details: {
            name: "details",
            text: i18n.t("Details"),
            multiple: false,
            type: "details",
            isPrimary: true,
        },

        dataEntry: {
            name: "data-entry",
            icon: "library_books",
            text: i18n.t("Go to Data Entry"),
            multiple: false,
            onClick: (dataSet: DataSet) =>
                history.push(generateUrl("dataEntry.edit", { id: dataSet.id })),
        },

        dashboard: {
            name: "dashboard",
            icon: "dashboard",
            text: i18n.t("Go to Dashboard"),
            multiple: false,
            onClick: () => history.push(generateUrl("dashboard")),
        },

        targetValues: {
            name: "add-target-values",
            icon: "assignment",
            text: i18n.t("Add Target Values"),
            multiple: false,
            onClick: () => setTargetPopulation(true),
        },

        downloadData: {
            name: "download-data",
            icon: "cloud_download",
            text: i18n.t("Download Data"),
            multiple: false,
        },

        configMER: {
            name: "mer",
            icon: "description",
            text: i18n.t("Generate / Configure MER"),
            multiple: false,
        },

        edit: {
            name: "edit",
            text: i18n.t("Edit"),
            multiple: false,
            onClick: (dataSet: DataSet) =>
                history.push(generateUrl("projects.edit", { id: dataSet.id })),
        },

        delete: {
            name: "delete",
            text: i18n.t("Delete"),
            multiple: true,
            onClick: (dataSets: DataSet[]) => {
                console.log("delete", dataSets);
            },
        },
    };

    const actionsForUserRoles: ActionsRoleMapping<typeof allActions> = {
        reportingAnalyst: ["edit", "delete", "targetValues", "configMER"],
        superUser: _.without(_.keys(allActions), "details") as Array<keyof typeof allActions>,
        encode: ["dataEntry"],
        analyser: ["dashboard", "downloadData"],
    };

    const roleKeys = (_.keys(actionsForUserRoles) as unknown) as Array<keyof Config["userRoles"]>;
    const actionsByRole = _(roleKeys)
        .flatMap(roleKey => {
            const actionKeys: Array<keyof typeof allActions> = actionsForUserRoles[roleKey] || [];
            return currentUser.hasRole(roleKey) ? actionKeys.map(key => allActions[key]) : [];
        })
        .uniq()
        .value();

    const actions = [allActions.details, ...actionsByRole];

    const help = i18n.t(
        `Click the blue button to create a new project or select a previously created project that you may want to access.

             Click the three dots on the right side of the screen if you wish to perform an action over a project.`
    );

    return { columns, initialSorting, detailsFields, actions, help };
}

const ProjectsList: React.FC = () => {
    const [targetPopulation, setTargetPopulation] = useState(false);
    const history = useHistory();
    const { api, config, currentUser } = useAppContext();
    const goToLandingPage = () => goTo(history, "/");
    const componentConfig = getConfig(history, currentUser, setTargetPopulation);
    const list = (_d2: unknown, filters: FiltersForList, pagination: Pagination) =>
        Project.getList(api, config, filters, pagination);

    const newProjectPageHandler = currentUser.canCreateProject()
        ? () => goTo(history, generateUrl("projects.new"))
        : null;

    return (
        <React.Fragment>
            <PageHeader
                title={i18n.t("Projects")}
                help={componentConfig.help}
                onBackClick={goToLandingPage}
            />

            <OldObjectsTable
                model={{ modelValidations: {} }}
                columns={componentConfig.columns}
                d2={{}}
                detailsFields={componentConfig.detailsFields}
                initialSorting={componentConfig.initialSorting}
                pageSize={20}
                actions={componentConfig.actions}
                list={list}
                disableMultiplePageSelection={true}
                buttonLabel={i18n.t("Create Project")}
                onButtonClick={newProjectPageHandler}
            />
            {targetPopulation && (
                <TargetValues closeTargetValues={() => setTargetPopulation(false)} />
            )}
        </React.Fragment>
    );
};

export default ProjectsList;

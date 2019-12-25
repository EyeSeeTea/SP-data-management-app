import React from "react";
import { OldObjectsTable, TableColumn } from "d2-ui-components";
import i18n from "../../locales";
import _ from "lodash";
import { useAppContext, CurrentUser } from "../../contexts/api-context";
import { useGoTo, GoTo } from "../../router";
import Project, { FiltersForList, ProjectForList } from "../../models/Project";
import { Pagination } from "../../types/ObjectsList";
import { Config } from "../../models/Config";
import { formatDateShort, formatDateLong } from "../../utils/date";
import ActionButton from "../../components/action-button/ActionButton";
import { GetPropertiesByType } from "../../types/utils";

type UserRolesConfig = Config["base"]["userRoles"];

type ActionsRoleMapping<Actions> = {
    [Key in keyof UserRolesConfig]?: Array<keyof Actions>;
};

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

function columnDate(
    field: GetPropertiesByType<ProjectForList, string>,
    format: "date" | "datetime"
) {
    const formatter = format === "date" ? formatDateShort : formatDateLong;
    return {
        name: field,
        getValue: (project: ProjectForList) => formatter(project[field]),
    };
}

function getConfig(goTo: GoTo, currentUser: CurrentUser) {
    const columns: TableColumn<ProjectForList>[] = [
        { name: "displayName", text: i18n.t("Name"), sortable: true },
        { ...columnDate("lastUpdated", "datetime"), text: i18n.t("Last updated"), sortable: true },
        {
            ...columnDate("created", "datetime"),
            text: i18n.t("Created"),
            sortable: true,
        },
        { ...columnDate("openingDate", "date"), text: i18n.t("Opening date"), sortable: true },
        { ...columnDate("closedDate", "date"), text: i18n.t("Closed date"), sortable: true },
    ];

    const initialSorting = ["displayName", "asc"];
    const detailsFields = [
        { name: "displayName", text: i18n.t("Name") },
        {
            name: "code",
            text: i18n.t("Code"),
            getValue: (project: ProjectForList) => `${project.code}`,
        },
        { name: "displayDescription", text: i18n.t("Description") },
        { ...columnDate("lastUpdated", "datetime"), text: i18n.t("Last Updated") },
        {
            name: "lastUpdatedBy",
            text: i18n.t("Last Updated By"),
            getValue: (project: ProjectForList) => ` ${project.lastUpdatedBy.name}`,
        },
        { ...columnDate("created", "datetime"), text: i18n.t("Created") },
        {
            name: "createdBy",
            text: i18n.t("Created By"),
            getValue: (project: ProjectForList) => `${project.user.displayName}`,
        },
        { ...columnDate("openingDate", "date"), text: i18n.t("Opening Date") },
        { ...columnDate("closedDate", "date"), text: i18n.t("Closed Date") },
        {
            name: "href",
            text: i18n.t("API Link"),
            getValue: function getDataSetLink(project: ProjectForList) {
                return <Link url={project.href + ".json"} />;
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

        actualValues: {
            name: "add-actual-values",
            icon: "library_books",
            text: i18n.t("Add Actual Values"),
            multiple: false,
            onClick: (project: ProjectForList) => goTo("actualValues", { id: project.id }),
        },

        dashboard: {
            name: "dashboard",
            icon: "dashboard",
            text: i18n.t("Go to Dashboard"),
            multiple: false,
            onClick: (project: ProjectForList) => goTo("dashboard", { id: project.id }),
        },
        reopenDatasets: {
            name: "reopen-datasets",
            icon: "lock_open",
            text: i18n.t("Reopen Datasets"),
            multiple: false,
        },

        targetValues: {
            name: "add-target-values",
            icon: "assignment",
            text: i18n.t("Add Target Values"),
            multiple: false,
            onClick: (project: ProjectForList) => goTo("targetValues", { id: project.id }),
        },

        downloadData: {
            name: "download-data",
            icon: "cloud_download",
            text: i18n.t("Download Data"),
            multiple: false,
        },

        edit: {
            name: "edit",
            text: i18n.t("Edit"),
            multiple: false,
            onClick: (project: ProjectForList) => goTo("projects.edit", { id: project.id }),
        },

        delete: {
            name: "delete",
            text: i18n.t("Delete"),
            multiple: true,
            onClick: (projects: ProjectForList[]) => {
                console.log("delete", projects);
            },
        },
    };

    const actionsForUserRoles: ActionsRoleMapping<typeof allActions> = {
        dataReviewer: ["actualValues", "targetValues", "dashboard", "downloadData", "edit"],
        dataViewer: ["dashboard", "downloadData"],
        admin: [
            "actualValues",
            "targetValues",
            "dashboard",
            "downloadData",
            "reopenDatasets",
            "edit",
            "delete",
        ],
        dataEntry: ["actualValues", "targetValues", "dashboard", "downloadData"],
    };

    const roleKeys = (_.keys(actionsForUserRoles) as unknown) as Array<keyof UserRolesConfig>;
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
    const goTo = useGoTo();
    const { api, config, currentUser } = useAppContext();
    const componentConfig = getConfig(goTo, currentUser);
    const canAccessMer = currentUser.hasRole("admin") || currentUser.hasRole("dataReviewer");

    const list = (_d2: unknown, filters: FiltersForList, pagination: Pagination) =>
        Project.getList(api, config, filters, pagination);

    const newProjectPageHandler = currentUser.canCreateProject()
        ? () => goTo("projects.new")
        : null;

    return (
        <React.Fragment>
            <div style={{ position: "absolute", top: 60, right: 250 }}>
                {canAccessMer && (
                    <ActionButton
                        label={i18n.t("MER Reports")}
                        onClick={() => goTo("report")}
                        style={{ marginRight: 20 }}
                    />
                )}

                {newProjectPageHandler && (
                    <ActionButton
                        label={i18n.t("Create Project")}
                        onClick={newProjectPageHandler}
                    />
                )}
            </div>

            <div style={{ marginTop: 25 }}>
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
                />
            </div>
        </React.Fragment>
    );
};

export default ProjectsList;

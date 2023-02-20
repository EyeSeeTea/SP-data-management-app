import React from "react";
import _ from "lodash";
import {
    TableColumn,
    TableAction,
    PaginationOptions,
    TableSorting,
} from "@eyeseetea/d2-ui-components";
import { Icon } from "@material-ui/core";

import i18n from "../../locales";
import { D2Api, Id } from "../../types/d2-api";
import { Config } from "../../models/Config";
import { GoTo } from "../../router";
import { CurrentUser } from "../../contexts/api-context";
import { ProjectForList } from "../../models/ProjectsList";
import { GetPropertiesByType } from "../../types/utils";
import { formatDateShort, formatDateLong } from "../../utils/date";
import { Action } from "../../models/user";
import Project from "../../models/Project";
import { downloadFile } from "../../utils/download";
import { Pagination } from "../../components/objects-list/objects-list-hooks";
import { Filter } from "./ProjectsListFilters";

export interface UrlState extends Filter {
    pagination: Pagination;
    sorting: TableSorting<ProjectForList>;
}

type ContextualAction =
    | Exclude<Action, "countryDashboard" | "create" | "accessMER" | "reopen">
    | "details";

const paginationOptions: PaginationOptions = {
    pageSizeOptions: [10, 20, 50],
    pageSizeInitialValue: 20,
};

const initialSorting = { field: "displayName" as const, order: "asc" as const };

export type ComponentConfig = ReturnType<typeof getComponentConfig>;

export function getComponentConfig(
    api: D2Api,
    config: Config,
    goTo: GoTo,
    setProjectIdsToDelete: (state: React.SetStateAction<Id[] | undefined>) => void,
    currentUser: CurrentUser
) {
    const columns: TableColumn<ProjectForList>[] = [
        { name: "displayName", text: i18n.t("Name"), sortable: true },
        {
            name: "parent",
            text: i18n.t("Country"),
            sortable: false,
            getValue: (project: ProjectForList) => project.parent.displayName,
        },
        { name: "code", text: i18n.t("Award Number"), sortable: true },
        {
            name: "sectors",
            text: i18n.t("Sectors"),
            sortable: false,
            getValue: (project: ProjectForList) =>
                project.sectors.map(sector => sector.displayName).join(", "),
        },
        { ...columnDate("openingDate", "date"), text: i18n.t("Start Date"), sortable: true },
        { ...columnDate("closedDate", "date"), text: i18n.t("End Date"), sortable: true },
        {
            ...columnDate("created", "datetime"),
            text: i18n.t("Created"),
            sortable: true,
        },
        {
            ...columnDate("lastUpdated", "datetime"),
            text: i18n.t("Last Updated (metadata)"),
            sortable: true,
        },
        {
            ...columnDate("lastUpdatedData", "datetime"),
            text: i18n.t("Last Updated (data)"),
            sortable: true,
        },
    ];

    const details = [
        ...columns,
        { name: "displayDescription" as const, text: i18n.t("Description") },
        {
            name: "user" as const,
            text: i18n.t("Created By"),
            getValue: (project: ProjectForList) => `${project.user.displayName}`,
        },
        {
            name: "lastUpdatedBy" as const,
            text: i18n.t("Last Updated By"),
            getValue: (project: ProjectForList) =>
                `${project.lastUpdatedBy ? project.lastUpdatedBy.name : "-"}`,
        },
        {
            name: "sharing" as const,
            text: i18n.t("Sharing"),
            getValue: getSharingInfo,
        },
        {
            name: "href" as const,
            text: i18n.t("API Link"),
            getValue: function getDataSetLink(project: ProjectForList) {
                return <Link url={project.href + ".json"} />;
            },
        },
    ];

    const allActions: Record<ContextualAction, TableAction<ProjectForList>> = {
        details: {
            name: "details",
            text: i18n.t("Details"),
            multiple: false,
            primary: true,
        },

        actualValues: {
            name: "add-actual-values",
            icon: <Icon>library_books</Icon>,
            text: i18n.t("Add Actual Values"),
            multiple: false,
            onClick: (ids: Id[]) => onFirst(ids, id => goTo("actualValues", { id })),
        },

        dashboard: {
            name: "dashboard",
            icon: <Icon>dashboard</Icon>,
            text: i18n.t("Go to Project Dashboard (current)"),
            multiple: false,
            onClick: (ids: Id[]) => onFirst(ids, id => goTo("projectDashboard", { id })),
        },

        awardNumberDashboard: {
            name: "award-number-dashboard",
            icon: <Icon>dashboard</Icon>,
            text: i18n.t("Go to Project Dashboard (all years)"),
            multiple: false,
            isActive: projects => projects[0].hasAwardNumberDashboard,
            onClick: (ids: Id[]) => onFirst(ids, id => goTo("awardNumberDashboard", { id })),
        },

        targetValues: {
            name: "add-target-values",
            icon: <Icon>assignment</Icon>,
            text: i18n.t("Add Target Values"),
            multiple: false,
            onClick: (ids: Id[]) => onFirst(ids, id => goTo("targetValues", { id })),
        },

        downloadData: {
            name: "download-data",
            icon: <Icon>cloud_download</Icon>,
            text: i18n.t("Download Data"),
            multiple: false,
            onClick: (ids: Id[]) => onFirst(ids, id => download(api, config, id)),
        },

        edit: {
            name: "edit",
            icon: <Icon>edit</Icon>,
            text: i18n.t("Edit"),
            multiple: false,
            onClick: (ids: Id[]) => onFirst(ids, id => goTo("projects.edit", { id })),
        },

        delete: {
            name: "delete",
            icon: <Icon>delete</Icon>,
            text: i18n.t("Delete"),
            multiple: true,
            onClick: setProjectIdsToDelete,
        },

        dataApproval: {
            name: "data-approval",
            icon: <Icon>playlist_add_check</Icon>,
            text: i18n.t("Data Approval"),
            multiple: false,
            onClick: (ids: Id[]) => onFirst(ids, id => goTo("dataApproval", { id })),
        },
    };

    const actionsByRole = _(allActions)
        .at(currentUser.actions as ContextualAction[])
        .compact()
        .uniqBy(action => action.name)
        .value();
    const actions = [allActions.details, ...actionsByRole];

    const searchBoxLabel = i18n.t("Search by name or code");

    const initialUrlState: UrlState = {
        search: "",
        countries: [],
        sectors: [],
        onlyActive: true,
        pagination: { page: 1, pageSize: paginationOptions.pageSizeInitialValue },
        sorting: initialSorting,
    };

    return {
        columns,
        initialSorting,
        details,
        actions,
        paginationOptions,
        searchBoxLabel,
        initialUrlState,
    };
}

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

async function download(api: D2Api, config: Config, projectId: string) {
    const project = await Project.get(api, config, projectId);
    downloadFile(await project.download());
}

function onFirst<T>(objs: T[], fn: (obj: T) => void): void {
    const obj = _.first(objs);
    if (obj) fn(obj);
}

function getSharingInfo(project: ProjectForList) {
    const { sharing } = project;
    return (
        <React.Fragment>
            <i>{i18n.t("Users")}:</i> {sharing.userAccesses.map(ua => ua.name).join(", ") || "-"}
            <br />
            <i>{i18n.t("User groups")}:</i>{" "}
            {sharing.userGroupAccesses.map(ua => ua.name).join(", ") || "-"}
        </React.Fragment>
    );
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

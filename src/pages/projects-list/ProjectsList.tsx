import { Icon } from "@material-ui/core";
import {
    PaginationOptions,
    TableAction,
    TableColumn,
    TablePagination,
    TableSorting,
} from "d2-ui-components";
import _ from "lodash";
import React, { useCallback, useState } from "react";
import ActionButton from "../../components/action-button/ActionButton";
import ListSelector from "../../components/list-selector/ListSelector";
import { useObjectsTable } from "../../components/objects-list/objects-list-hooks";
import { ObjectsList, ObjectsListProps } from "../../components/objects-list/ObjectsList";
import { CurrentUser, useAppContext } from "../../contexts/api-context";
import i18n from "../../locales";
import { Config } from "../../models/Config";
import Project from "../../models/Project";
import { FiltersForList, ProjectForList } from "../../models/ProjectsList";
import { Action } from "../../models/user";
import { GoTo, useGoTo } from "../../router";
import { D2Api, Id } from "../../types/d2-api";
import { GetPropertiesByType } from "../../types/utils";
import { formatDateLong, formatDateShort } from "../../utils/date";
import { downloadFile } from "../../utils/download";
import ProjectsListFilters, { Filter } from "./ProjectsListFilters";
import DeleteDialog from "../../components/delete-dialog/DeleteDialog";
import styled from "styled-components";
import { useListSelector } from "../../components/list-selector/ListSelectorHooks";

type ContextualAction =
    | Exclude<Action, "countryDashboard" | "create" | "accessMER" | "reopen">
    | "details";

function getComponentConfig(
    api: D2Api,
    config: Config,
    goTo: GoTo,
    setProjectIdsToDelete: (state: React.SetStateAction<Id[] | undefined>) => void,
    currentUser: CurrentUser
) {
    const paginationOptions: PaginationOptions = {
        pageSizeOptions: [10, 20, 50],
        pageSizeInitialValue: 20,
    };

    const initialSorting = { field: "displayName" as const, order: "asc" as const };

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
        { ...columnDate("lastUpdated", "datetime"), text: i18n.t("Last Updated"), sortable: true },
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

    return { columns, initialSorting, details, actions, paginationOptions, searchBoxLabel };
}

interface ProjectsListProps {}

const ProjectsList: React.FC<ProjectsListProps> = () => {
    const goTo = useGoTo();
    const { api, config, currentUser } = useAppContext();
    const [projectIdsToDelete, setProjectIdsToDelete] = useState<Id[] | undefined>(undefined);
    const baseConfig = React.useMemo(() => {
        return getComponentConfig(api, config, goTo, setProjectIdsToDelete, currentUser);
    }, [api, config, currentUser, goTo]);

    const [filter, setFilter] = useState<Filter>(initialFilter);
    const onViewChange = useListSelector("projects");

    const getRows = React.useMemo(
        () => async (
            search: string,
            paging: TablePagination,
            sorting: TableSorting<ProjectForList>
        ) => {
            const filters: FiltersForList = {
                search,
                countryIds: filter.countries,
                sectorIds: filter.sectors,
                onlyActive: filter.onlyActive,
                createdByAppOnly: true,
                userCountriesOnly: true,
            };
            const listPagination = { ...paging, ...paginationOptions };

            return Project.getList(api, config, filters, sorting, listPagination);
        },
        [api, config, filter.countries, filter.onlyActive, filter.sectors]
    );

    const tableProps = useObjectsTable(baseConfig, getRows);

    const filterOptions = React.useMemo(() => {
        return { countries: currentUser.getCountries(), sectors: config.sectors };
    }, [currentUser, config]);

    const closeDeleteDialog = useCallback(() => {
        setProjectIdsToDelete(undefined);
        tableProps.reload();
    }, [setProjectIdsToDelete, tableProps]);

    const goToMerReports = React.useCallback(() => goTo("report"), [goTo]);

    const canAccessReports = currentUser.can("accessMER");
    const canCreateProjects = currentUser.can("create");
    const goToNewProject = React.useCallback(() => goTo("projects.new"), [goTo]);
    const newProjectPageHandler = canCreateProjects ? goToNewProject : undefined;

    return (
        <React.Fragment>
            {projectIdsToDelete && (
                <DeleteDialog projectIds={projectIdsToDelete} onClose={closeDeleteDialog} />
            )}

            <ObjectsListStyled<React.FC<ObjectsListProps<ProjectForList>>> {...tableProps}>
                <ProjectsListFilters
                    filter={filter}
                    filterOptions={filterOptions}
                    onChange={setFilter}
                />

                {canAccessReports && (
                    <ActionButton
                        label={i18n.t("MER Reports")}
                        onClick={goToMerReports}
                        style={styles.merReports}
                    />
                )}

                {newProjectPageHandler && (
                    <ActionButton
                        label={i18n.t("Create Project")}
                        onClick={newProjectPageHandler}
                    />
                )}

                <ListSelector view="projects" onChange={onViewChange} />
            </ObjectsListStyled>
        </React.Fragment>
    );
};

const styles = {
    merReports: { marginLeft: 30, marginRight: 20 },
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

const paginationOptions = {
    pageSizeOptions: [10, 20, 50],
};

const initialFilter: Filter = {
    onlyActive: true,
};

const ObjectsListStyled = styled(ObjectsList)`
    .MuiTextField-root {
        max-width: 250px;
    }
`;

export default React.memo(ProjectsList);

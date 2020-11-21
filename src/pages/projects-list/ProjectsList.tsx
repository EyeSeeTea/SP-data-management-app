import React, { useState, useEffect, useCallback } from "react";
import { ObjectsTable, TableColumn, TableAction, TableSorting, TableState } from "d2-ui-components";
import { MouseActionsMapping } from "d2-ui-components";
import { TablePagination } from "d2-ui-components";
import i18n from "../../locales";
import _ from "lodash";
import { useAppContext, CurrentUser } from "../../contexts/api-context";
import { useGoTo, GoTo } from "../../router";
import Project from "../../models/Project";
import { Config } from "../../models/Config";
import { formatDateShort, formatDateLong } from "../../utils/date";
import ActionButton from "../../components/action-button/ActionButton";
import { GetPropertiesByType } from "../../types/utils";
import { downloadFile } from "../../utils/download";
import { D2Api, Id } from "../../types/d2-api";
import { Icon, LinearProgress, CircularProgress } from "@material-ui/core";
import ProjectsListFilters, { Filter } from "./ProjectsListFilters";
import { ProjectForList, FiltersForList } from "../../models/ProjectsList";
import DeleteDialog from "../../components/delete-dialog/DeleteDialog";
import { Action } from "../../models/user";
import { useLocation } from "react-router-dom";
import { parse } from "querystring";

type ContextualAction = Exclude<Action, "create" | "accessMER" | "reopen"> | "details";

const mouseActionsMapping: MouseActionsMapping = {
    left: { type: "contextual" },
    right: { type: "contextual" },
};

function getComponentConfig(
    api: D2Api,
    config: Config,
    goTo: GoTo,
    setProjectIdsToDelete: (state: React.SetStateAction<Id[] | undefined>) => void,
    currentUser: CurrentUser
) {
    const initialPagination = { page: 1, pageSize: 20 };
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
        { ...columnDate("lastUpdated", "datetime"), text: i18n.t("Last Updated"), sortable: true },
        {
            ...columnDate("created", "datetime"),
            text: i18n.t("Created"),
            sortable: true,
        },
        { ...columnDate("openingDate", "date"), text: i18n.t("Opening Date"), sortable: true },
        { ...columnDate("closedDate", "date"), text: i18n.t("Closed Date"), sortable: true },
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
            text: i18n.t("Go to Dashboard"),
            multiple: false,
            onClick: (ids: Id[]) => onFirst(ids, id => goTo("dashboard", { id })),
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

    return { columns, initialSorting, details, actions, initialPagination };
}

type ProjectTableSorting = TableSorting<ProjectForList>;

const ProjectsList: React.FC = () => {
    const goTo = useGoTo();
    const { api, config, currentUser } = useAppContext();
    const match = useLocation();
    const queryParams = parse(match.search.slice(1));
    const [projectIdsToDelete, setProjectIdsToDelete] = useState<Id[] | undefined>(undefined);
    const componentConfig = React.useMemo(() => {
        return getComponentConfig(api, config, goTo, setProjectIdsToDelete, currentUser);
    }, [api, config, currentUser]);
    const [rows, setRows] = useState<ProjectForList[] | undefined>(undefined);
    const [pagination, setPagination] = useState(componentConfig.initialPagination);
    const [sorting, setSorting] = useState<ProjectTableSorting>(componentConfig.initialSorting);
    const initialSearch = _.castArray(queryParams.search)[0] || "";
    const [search, setSearch] = useState(initialSearch);
    const [filter, setFilter] = useState<Filter>(initialFilter);
    const [isLoading, setLoading] = useState(true);
    const [objectsTableKey, objectsTableKeySet] = useState(() => new Date().getTime());

    useEffect(() => {
        getProjects(sorting, { page: 1 });
    }, [search, filter, objectsTableKey]);

    const filterOptions = React.useMemo(() => {
        return { countries: currentUser.getCountries(), sectors: config.sectors };
    }, [currentUser, config]);

    async function getProjects(
        sorting: TableSorting<ProjectForList>,
        paginationOptions: Partial<TablePagination>
    ) {
        const filters: FiltersForList = {
            search,
            countryIds: filter.countries,
            sectorIds: filter.sectors,
            onlyActive: filter.onlyActive,
            createdByAppOnly: true,
            userCountriesOnly: true,
        };
        const listPagination = { ...pagination, ...paginationOptions };

        setLoading(true);
        const res = await Project.getList(api, config, filters, sorting, listPagination);
        setRows(res.objects);
        setPagination({ ...listPagination, ...res.pager });
        setSorting(sorting);
        setLoading(false);
    }

    const onStateChange = useCallback(
        (newState: TableState<ProjectForList>) => {
            const { pagination, sorting } = newState;
            getProjects(sorting, pagination);
        },
        [search, filter, objectsTableKey]
    );

    const closeDeleteDialog = useCallback(() => {
        setProjectIdsToDelete(undefined);
        objectsTableKeySet(new Date().getTime()); // force update of objects table
    }, []);

    const canAccessReports = currentUser.can("accessMER");
    const newProjectPageHandler = currentUser.can("create") && (() => goTo("projects.new"));

    return (
        <div style={{ marginTop: 25 }}>
            {isLoading ? <span data-test-loading /> : <span data-test-loaded />}

            {!rows && <LinearProgress />}

            {projectIdsToDelete && (
                <DeleteDialog projectIds={projectIdsToDelete} onClose={closeDeleteDialog} />
            )}

            {rows && (
                <ObjectsTable<ProjectForList>
                    key={objectsTableKey}
                    initialSearch={initialSearch}
                    searchBoxLabel={i18n.t("Search by name or code")}
                    onChangeSearch={setSearch}
                    pagination={pagination}
                    paginationOptions={paginationOptions}
                    onChange={onStateChange}
                    columns={componentConfig.columns}
                    details={componentConfig.details}
                    actions={componentConfig.actions}
                    mouseActionsMapping={mouseActionsMapping}
                    rows={rows}
                    filterComponents={
                        <React.Fragment key="filters">
                            <ProjectsListFilters
                                filter={filter}
                                filterOptions={filterOptions}
                                onChange={setFilter}
                            />

                            {canAccessReports && (
                                <ActionButton
                                    label={i18n.t("MER Reports")}
                                    onClick={() => goTo("report")}
                                    style={{ marginLeft: 50, marginRight: 20 }}
                                />
                            )}

                            {newProjectPageHandler && (
                                <ActionButton
                                    label={i18n.t("Create Project")}
                                    onClick={newProjectPageHandler}
                                />
                            )}

                            <LoadingSpinner isVisible={isLoading} />
                        </React.Fragment>
                    }
                />
            )}
        </div>
    );
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

const LoadingSpinner: React.FunctionComponent<{ isVisible: boolean }> = ({ isVisible }) => (
    <React.Fragment>
        <div style={{ flex: "10 1 auto" }}></div>
        {isVisible && <CircularProgress />}
    </React.Fragment>
);

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

export default React.memo(ProjectsList);

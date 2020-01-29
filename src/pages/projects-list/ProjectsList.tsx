import React, { useState, useEffect } from "react";
import { ObjectsTable, TableColumn, TableAction, TableSorting, TableState } from "d2-ui-components";
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
import { D2Api } from "d2-api";
import { Icon } from "@material-ui/core";
import ProjectsListFilters, { Filter } from "./ProjectsListFilters";
import { ProjectForList, FiltersForList } from "../../models/ProjectsList";

type UserRolesConfig = Config["base"]["userRoles"];

type ActionsRoleMapping<Actions> = {
    [Key in keyof UserRolesConfig]?: Array<keyof Actions>;
};

function getComponentConfig(api: D2Api, config: Config, goTo: GoTo, currentUser: CurrentUser) {
    const initialPagination = {
        page: 1,
        pageSize: 20,
        pageSizeOptions: [10, 20, 50],
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
        { name: "code", text: i18n.t("Code"), sortable: true },
        {
            name: "sectors",
            text: i18n.t("Sectors"),
            sortable: false,
            getValue: (project: ProjectForList) =>
                project.sectors.map(sector => sector.displayName).join(", "),
        },
        { ...columnDate("lastUpdated", "datetime"), text: i18n.t("Last updated"), sortable: true },
        {
            ...columnDate("created", "datetime"),
            text: i18n.t("Created"),
            sortable: true,
        },
        { ...columnDate("openingDate", "date"), text: i18n.t("Opening date"), sortable: true },
        { ...columnDate("closedDate", "date"), text: i18n.t("Closed date"), sortable: true },
    ];

    const details = [
        ...columns.map(column => _.omit(column, ["sortable"])),
        { name: "displayDescription" as const, text: i18n.t("Description") },
        {
            name: "user" as const,
            text: i18n.t("Created By"),
            getValue: (project: ProjectForList) => `${project.user.displayName}`,
        },
        {
            name: "code" as const,
            text: i18n.t("Code"),
            getValue: (project: ProjectForList) => `${project.code}`,
        },
        {
            name: "href" as const,
            text: i18n.t("API Link"),
            getValue: function getDataSetLink(project: ProjectForList) {
                return <Link url={project.href + ".json"} />;
            },
        },
    ];

    const allActions: Record<string, TableAction<ProjectForList>> = {
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
            onClick: (projects: ProjectForList[]) => goTo("actualValues", { id: projects[0].id }),
        },

        dashboard: {
            name: "dashboard",
            icon: <Icon>dashboard</Icon>,
            text: i18n.t("Go to Dashboard"),
            multiple: false,
            onClick: (projects: ProjectForList[]) => goTo("dashboard", { id: projects[0].id }),
        },
        reopenDatasets: {
            name: "reopen-datasets",
            icon: <Icon>lock_open</Icon>,
            text: i18n.t("Reopen Datasets"),
            multiple: false,
        },

        targetValues: {
            name: "add-target-values",
            icon: <Icon>assignment</Icon>,
            text: i18n.t("Add Target Values"),
            multiple: false,
            onClick: (projects: ProjectForList[]) => goTo("targetValues", { id: projects[0].id }),
        },

        downloadData: {
            name: "download-data",
            icon: <Icon>cloud_download</Icon>,
            text: i18n.t("Download Data"),
            multiple: false,
            onClick: (projects: ProjectForList[]) => download(api, config, projects[0].id),
        },

        edit: {
            name: "edit",
            icon: <Icon>edit</Icon>,
            text: i18n.t("Edit"),
            multiple: false,
            onClick: (projects: ProjectForList[]) => goTo("projects.edit", { id: projects[0].id }),
        },

        delete: {
            name: "delete",
            icon: <Icon>delete</Icon>,
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

    return { columns, initialSorting, details, actions, initialPagination };
}

type ProjectTableSorting = TableSorting<ProjectForList>;

const ProjectsList: React.FC = () => {
    const goTo = useGoTo();
    const { api, config, currentUser } = useAppContext();
    const componentConfig = React.useMemo(() => {
        return getComponentConfig(api, config, goTo, currentUser);
    }, [api, config, currentUser]);
    const [rows, setRows] = useState<ProjectForList[] | undefined>(undefined);
    const [pagination, setPagination] = useState(componentConfig.initialPagination);
    const [sorting, setSorting] = useState<ProjectTableSorting>(componentConfig.initialSorting);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<Filter>({});
    const [isLoading, setLoading] = useState(true);

    useEffect(() => {
        getProjects();
    }, [pagination.page, sorting, search, filter]);

    const filterOptions = React.useMemo(
        () => ({ countries: config.countries, sectors: config.sectors }),
        [config]
    );

    async function getProjects() {
        const filters: FiltersForList = {
            search,
            countryIds: filter.countries,
            sectorIds: filter.sectors,
            onlyActive: filter.onlyActive,
        };
        setLoading(true);
        const res = await Project.getList(api, config, filters, sorting, pagination);
        setRows(res.objects);
        setPagination(pagination => ({ ...pagination, ...res.pager }));
        setLoading(false);
    }

    function onStateChange(state: TableState<ProjectForList>) {
        setPagination(state.pagination);
        setSorting(state.sorting);
    }

    const canAccessReports = currentUser.hasRole("admin") || currentUser.hasRole("dataReviewer");
    const newProjectPageHandler = currentUser.canCreateProject() && (() => goTo("projects.new"));

    return (
        <React.Fragment>
            <div style={{ marginTop: 25 }}>
                {isLoading ? <span data-test-loading /> : <span data-test-loaded />}

                <ObjectsTable<ProjectForList>
                    searchBoxLabel={i18n.t("Search by name")}
                    onChangeSearch={setSearch}
                    pagination={pagination}
                    onChange={onStateChange}
                    columns={componentConfig.columns}
                    details={componentConfig.details}
                    actions={componentConfig.actions}
                    rows={rows || []}
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
                        </React.Fragment>
                    }
                />
            </div>
        </React.Fragment>
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

export default ProjectsList;

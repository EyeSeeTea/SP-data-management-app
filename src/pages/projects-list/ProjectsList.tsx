import _ from "lodash";
import { TableSorting } from "@eyeseetea/d2-ui-components";
import React, { useCallback } from "react";
import styled from "styled-components";
import ActionButton from "../../components/action-button/ActionButton";
import DeleteDialog from "../../components/delete-dialog/DeleteDialog";
import ListSelector from "../../components/list-selector/ListSelector";
import { useListSelector } from "../../components/list-selector/ListSelectorHooks";
import {
    Pagination,
    useObjectsTable,
    TableOptions,
} from "../../components/objects-list/objects-list-hooks";
import { ObjectsList, ObjectsListProps } from "../../components/objects-list/ObjectsList";
import { useAppContext } from "../../contexts/api-context";
import i18n from "../../locales";
import Project from "../../models/Project";
import { FiltersForList, ProjectForList } from "../../models/ProjectsList";
import { useGoTo } from "../../router";
import { Id } from "../../types/d2-api";
import { ActionName, getComponentConfig, UrlState } from "./ProjectsListConfig";
import ProjectsListFilters, { FilterOptions } from "./ProjectsListFilters";
import { useUrlParams } from "../../utils/use-url-params";
import { useQueryStringParams } from "./ProjectsListParams";
import { AttachFilesDialog } from "../../components/attach-files-dialog/AttachFilesDialog";

type ActionSelected = {
    ids: Id[];
    actionName: ActionName;
};

const ProjectsList: React.FC = () => {
    const goTo = useGoTo();
    const { api, config, currentUser } = useAppContext();
    const [actionSelected, setActionSelected] = React.useState<ActionSelected>();

    const onClickAction = (ids: Id[], actionName: ActionName) => {
        setActionSelected({
            ids,
            actionName,
        });
    };

    const componentConfig = React.useMemo(() => {
        return getComponentConfig(api, config, goTo, onClickAction, currentUser);
    }, [api, config, currentUser, goTo]);

    const onViewChange = useListSelector("projects");

    const options = useQueryStringParams(componentConfig);

    const [params, setParams] = useUrlParams<UrlState>(options);

    const getRows = React.useMemo(
        () => async (search: string, paging: Pagination, sorting: TableSorting<ProjectForList>) => {
            const filters: FiltersForList = {
                search: search.trim(),
                countryIds: params.countries,
                sectorIds: params.sectors,
                onlyActive: params.onlyActive,
                createdByAppOnly: true,
                userCountriesOnly: true,
            };
            const listPagination = { ...paging, ...componentConfig.paginationOptions };

            return Project.getList(api, config, filters, sorting, listPagination);
        },
        [api, config, params, componentConfig]
    );

    const updateState = React.useCallback(
        (newTableOptions: TableOptions<ProjectForList>) => {
            setParams({ ...params, ...newTableOptions });
        },
        [setParams, params]
    );

    const tableProps = useObjectsTable(componentConfig, getRows, params, updateState);

    const filterOptions = useFilterOptions(params);

    const closeDeleteDialog = useCallback(() => {
        setActionSelected(undefined);
        tableProps.reload();
    }, [setActionSelected, tableProps]);

    const goToMerReports = React.useCallback(() => goTo("report"), [goTo]);
    const canAccessReports = currentUser.can("accessMER");
    const canCreateProjects = currentUser.can("create");
    const goToNewProject = React.useCallback(() => goTo("projects.new"), [goTo]);
    const newProjectPageHandler = canCreateProjects ? goToNewProject : undefined;

    const onAttachModalClose = () => {
        setActionSelected(undefined);
    };

    return (
        <React.Fragment>
            {actionSelected?.actionName === "delete" && actionSelected.ids && (
                <DeleteDialog projectIds={actionSelected.ids} onClose={closeDeleteDialog} />
            )}

            {actionSelected?.actionName === "attachFiles" && actionSelected.ids && (
                <AttachFilesDialog onClose={onAttachModalClose} projectId={actionSelected.ids[0]} />
            )}

            <ObjectsListStyled<React.FC<ObjectsListProps<ProjectForList>>> {...tableProps}>
                <ProjectsListFilters
                    filter={params}
                    filterOptions={filterOptions}
                    onChange={newFilter =>
                        setParams({
                            ...params,
                            ...newFilter,
                            pagination: { page: 1, pageSize: params.pagination.pageSize },
                        })
                    }
                />

                {canAccessReports && (
                    <ActionButton
                        label={i18n.t("Monthly Report")}
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

const ObjectsListStyled = styled(ObjectsList)`
    .MuiTextField-root {
        max-width: 250px;
    }
`;

function useFilterOptions(options: { onlyActive: boolean }) {
    const { api, currentUser, config } = useAppContext();
    const { onlyActive } = options;

    const [filterOptions, setFilterOptions] = React.useState<FilterOptions>(() => ({
        countries: currentUser.getCountries(),
        countriesOnlyActive: [],
        sectors: config.sectors,
    }));

    React.useEffect(() => {
        async function run() {
            const countriesFromProjects = await Project.getCountries(api, config, { onlyActive });

            const countriesFromProjectVisibleByUser = _.intersectionBy(
                countriesFromProjects,
                currentUser.getCountries(),
                country => country.id
            );

            const newFilterOptions: FilterOptions = {
                countries: countriesFromProjectVisibleByUser,
                sectors: config.sectors,
            };

            setFilterOptions(newFilterOptions);
        }
        run();
    }, [api, currentUser, config, onlyActive]);

    return filterOptions;
}

export default React.memo(ProjectsList);

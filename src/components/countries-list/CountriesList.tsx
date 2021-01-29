import React from "react";
import _ from "lodash";
import {
    TableColumn,
    TableSorting,
    PaginationOptions,
    TablePagination,
    TableAction,
    useObjectsTable,
    TableConfig,
    ObjectsList,
} from "d2-ui-components";

import { useAppContext } from "../../contexts/api-context";
import i18n from "../../locales";
import ListSelector from "../list-selector/ListSelector";
import { CountriesList as CountriesListModel, Country } from "../../models/CountriesList";
import { formatDateLong } from "../../utils/date";
import { Icon } from "@material-ui/core";
import { Id } from "../../types/d2-api";
import { useGoTo, GoTo } from "../../router";
import { useListSelector } from "../list-selector/ListSelectorHooks";
import User from "../../models/user";

interface CountryView {
    id: string;
    name: string;
    code: string;
    projectsCount: number;
    created: string;
    lastUpdated: string;
}

interface CountriesListProps {}

const CountriesList: React.FC<CountriesListProps> = () => {
    const { api, config, currentUser } = useAppContext();
    const goTo = useGoTo();
    const baseConfig = React.useMemo(() => {
        return getBaseListConfig(currentUser, goTo);
    }, [currentUser, goTo]);

    const getRows = React.useMemo(
        () => async (
            search: string,
            paging: TablePagination,
            sorting: TableSorting<CountryView>
        ) => {
            const instance = new CountriesListModel(api, config);
            const { pager, objects } = await instance.get(search, paging, sorting);
            return { pager, objects: getCountryViews(objects) };
        },
        [api, config]
    );

    const tableProps = useObjectsTable(baseConfig, getRows);
    const onViewChange = useListSelector("countries");

    return (
        <ObjectsList<CountryView> {...tableProps}>
            <ListSelector view="countries" onChange={onViewChange} />
        </ObjectsList>
    );
};

function getBaseListConfig(currentUser: User, goTo: GoTo): TableConfig<CountryView> {
    const paginationOptions: PaginationOptions = {
        pageSizeOptions: [10, 20, 50],
        pageSizeInitialValue: 20,
    };

    const initialSorting: TableSorting<CountryView> = {
        field: "name" as const,
        order: "asc" as const,
    };

    const columns: TableColumn<CountryView>[] = [
        { name: "name", text: i18n.t("Name"), sortable: true },
        { name: "code", text: i18n.t("Code"), sortable: true },
        { name: "projectsCount", text: i18n.t("# Projects"), sortable: true },
        { name: "lastUpdated", text: i18n.t("Last Updated"), sortable: true, hidden: true },
        { name: "created", text: i18n.t("Created"), sortable: true, hidden: true },
    ];

    const details = columns;

    const actions: TableAction<CountryView>[] = _.compact([
        {
            name: "details",
            text: i18n.t("Details"),
            multiple: false,
            primary: true,
        },
        currentUser.actions.includes("countryDashboard")
            ? {
                  name: "dashboard",
                  icon: <Icon>dashboard</Icon>,
                  text: i18n.t("Go to Dashboard"),
                  isActive: countries => _(countries).every(country => country.projectsCount > 0),
                  multiple: false,
                  onClick: (ids: Id[]) => goTo("countryDashboard", { id: ids[0] }),
              }
            : null,
    ]);

    const searchBoxLabel = i18n.t("Search by name or code");

    return { columns, details, actions, initialSorting, paginationOptions, searchBoxLabel };
}

function getCountryViews(countries: Country[]): CountryView[] {
    return countries.map(country => ({
        ...country,
        created: formatDateLong(country.created),
        lastUpdated: formatDateLong(country.lastUpdated),
    }));
}

export default CountriesList;

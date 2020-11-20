import React from "react";
import {
    TableColumn,
    TableSorting,
    PaginationOptions,
    TablePagination,
    TableAction,
} from "d2-ui-components";

import { ObjectsList } from "../objects-list/ObjectsList";
import { TableConfig, useObjectsTable } from "../objects-list/objects-list-hooks";
import { useAppContext } from "../../contexts/api-context";
import i18n from "../../locales";
import ListSelector, { ListView } from "../list-selector/ListSelector";
import { CountriesList as CountriesListModel, Country } from "../../models/CountriesList";
import { formatDateLong } from "../../utils/date";

interface CountryView {
    id: string;
    name: string;
    code: string;
    projectsCount: number;
    created: string;
    lastUpdated: string;
}

interface CountriesListProps {
    onViewChange(view: ListView): void;
}

const CountriesList: React.FC<CountriesListProps> = props => {
    const { onViewChange } = props;
    const { api, config } = useAppContext();
    const baseConfig = React.useMemo(getBaseListConfig, []);

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

    return (
        <ObjectsList<CountryView> {...tableProps}>
            <ListSelector view="countries" onChange={onViewChange} />
        </ObjectsList>
    );
};

function getBaseListConfig(): TableConfig<CountryView> {
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
        { name: "projectsCount", text: i18n.t("# Projects"), sortable: false },
        { name: "lastUpdated", text: i18n.t("Last Updated"), sortable: true, hidden: true },
        { name: "created", text: i18n.t("Created"), sortable: true, hidden: true },
    ];

    const details = columns;

    const actions: TableAction<CountryView>[] = [
        {
            name: "details",
            text: i18n.t("Details"),
            multiple: false,
            primary: true,
        },
    ];

    return { columns, details, actions, initialSorting, paginationOptions };
}

function getCountryViews(countries: Country[]): CountryView[] {
    return countries.map(country => ({
        ...country,
        created: formatDateLong(country.created),
        lastUpdated: formatDateLong(country.lastUpdated),
    }));
}

export default CountriesList;

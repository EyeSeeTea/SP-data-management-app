import React from "react";
import _ from "lodash";
import {
    TableColumn,
    TableSorting,
    ReferenceObject,
    PaginationOptions,
    TablePagination,
    ObjectsTableDetailField,
    TableState,
    TableAction,
} from "d2-ui-components";
import { ObjectsListProps } from "./ObjectsList";
import i18n from "../../locales";
import { useLocation } from "react-router-dom";
import { parse } from "querystring";
import { Pager } from "../../models/PaginatedObjects";

export interface TableConfig<Obj extends ReferenceObject> {
    columns: TableColumn<Obj>[];
    actions: TableAction<Obj>[];
    paginationOptions: PaginationOptions;
    initialSorting: TableSorting<Obj>;
    details?: ObjectsTableDetailField<Obj>[];
    searchBoxLabel?: string;
}

type GetRows<Obj extends ReferenceObject> = (
    search: string,
    paging: TablePagination,
    sorting: TableSorting<Obj>
) => Promise<{ objects: Obj[]; pager: Pager } | undefined>;

const initialPagination: TablePagination = { page: 1, pageSize: 20, total: 0 };

export function useObjectsTable<Obj extends ReferenceObject>(
    config: TableConfig<Obj>,
    getRows: GetRows<Obj>
): ObjectsListProps<Obj> {
    const [rows, setRows] = React.useState<Obj[]>();
    const [pagination, setPagination] = React.useState<TablePagination>(initialPagination);
    const [sorting, setSorting] = React.useState<TableSorting<Obj>>(config.initialSorting);
    const [isLoading, setLoading] = React.useState(true);

    const match = useLocation();
    const queryParams = parse(match.search.slice(1));
    const initialSearch = _.castArray(queryParams.search)[0] || "";
    const [search, setSearch] = React.useState(initialSearch);

    const reload = React.useCallback(async () => {
        setLoading(true);
        const res = await getRows(search.trim(), pagination, sorting);

        if (res) {
            setRows(res.objects);
            setPagination({ ...pagination, ...res.pager });
        } else {
            setRows([]);
            setPagination(initialPagination);
        }

        setSorting(sorting);
        setLoading(false);
    }, [getRows, search]);

    const loadRows = React.useCallback(
        async (sorting: TableSorting<Obj>, paginationOptions: Partial<TablePagination>) => {
            setLoading(true);
            const paging = { ...initialPagination, ...paginationOptions };
            const res = await getRows(search.trim(), paging, sorting);

            if (res) {
                setRows(res.objects);
                setPagination({ ...paginationOptions, ...res.pager });
            } else {
                setRows([]);
                setPagination(initialPagination);
            }

            setSorting(sorting);
            setLoading(false);
        },
        [getRows, search]
    );

    React.useEffect(() => {
        loadRows(sorting, initialPagination);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadRows]);

    const onChange = React.useCallback(
        (newState: TableState<Obj>) => {
            const { pagination, sorting } = newState;
            // TODO: We should set sorting/pagination and remove them from within loadRows (and eslint-disable)
            loadRows(sorting, pagination);
        },
        [loadRows]
    );

    return {
        ...config,
        isLoading,
        rows,
        onChange,
        pagination,
        searchBoxLabel: config.searchBoxLabel || i18n.t("Search by name"),
        onChangeSearch: setSearch,
        reload,
    };
}

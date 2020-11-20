/* eslint react-hooks/exhaustive-deps: 1 */ // --> ON
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
) => Promise<{ objects: Obj[]; pager: Pager }>;

const initialPagination: TablePagination = { page: 1, pageSize: 20, total: 0 };

// Group state to avoid multiple re-renders on individual setState dispatchers
interface State<Obj extends ReferenceObject> {
    rows: Obj[] | undefined;
    pagination: TablePagination;
    sorting: TableSorting<Obj>;
    isLoading: boolean;
}

export function useObjectsTable<Obj extends ReferenceObject>(
    config: TableConfig<Obj>,
    getRows: GetRows<Obj>
): ObjectsListProps<Obj> {
    const [state, setState] = React.useState<State<Obj>>(() => ({
        rows: undefined,
        pagination: initialPagination,
        sorting: config.initialSorting,
        isLoading: false,
    }));

    const match = useLocation();
    const queryParams = parse(match.search.slice(1));
    const initialSearch = _.castArray(queryParams.search)[0] || "";
    const [search, setSearch] = React.useState(initialSearch);

    const loadRows = React.useCallback(
        async (sorting: TableSorting<Obj>, pagination: Partial<TablePagination>) => {
            setState(state => ({ ...state, isLoading: true }));
            const paging = { ...initialPagination, ...pagination };
            const res = await getRows(search.trim(), paging, sorting);
            setState({
                rows: res.objects,
                pagination: { ...pagination, ...res.pager },
                sorting,
                isLoading: false,
            });
        },
        [getRows, search]
    );

    const reload = React.useCallback(async () => {
        loadRows(state.sorting, state.pagination);
    }, [loadRows, state.sorting, state.pagination]);

    React.useEffect(() => {
        loadRows(config.initialSorting, initialPagination);
    }, [config.initialSorting, loadRows]);

    const onChange = React.useCallback(
        (newState: TableState<Obj>) => {
            loadRows(newState.sorting, newState.pagination);
        },
        [loadRows]
    );

    return {
        ...config,
        isLoading: state.isLoading,
        rows: state.rows,
        onChange,
        pagination: state.pagination,
        searchBoxLabel: config.searchBoxLabel || i18n.t("Search by name"),
        onChangeSearch: setSearch,
        reload,
    };
}

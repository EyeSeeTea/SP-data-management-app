import React from "react";
import {
    TableColumn,
    TableSorting,
    ReferenceObject,
    PaginationOptions,
    TablePagination,
    ObjectsTableDetailField,
    TableState,
    TableAction,
} from "@eyeseetea/d2-ui-components";
import { ObjectsListProps } from "./ObjectsList";
import { Pager } from "../../models/PaginatedObjects";

export interface TableConfig<Obj extends ReferenceObject> {
    columns: TableColumn<Obj>[];
    actions: TableAction<Obj>[];
    initialPagination?: TablePagination;
    paginationOptions: PaginationOptions;
    initialSorting: TableSorting<Obj>;
    details?: ObjectsTableDetailField<Obj>[];
    searchBoxLabel: string;
}

export type Pagination = Omit<TablePagination, "total">;

type GetRows<Obj extends ReferenceObject> = (
    search: string,
    paging: Pagination,
    sorting: TableSorting<Obj>
) => Promise<{ objects: Obj[]; pager: Pager }>;

const initialPagination: TablePagination = { page: 1, pageSize: 20, total: 0 };

// Group state to avoid multiple re-renders on individual setState dispatchers
interface State<Obj extends ReferenceObject> {
    rows: Obj[] | undefined;
    isLoading: boolean;
    total: number;
}

const initialState: State<any> = {
    rows: undefined,
    isLoading: false,
    total: 0,
};

interface UseObjectsTable<Obj extends ReferenceObject> extends ObjectsListProps<Obj> {}

export interface TableOptions<Obj extends ReferenceObject> {
    search: string;
    pagination: Pagination;
    sorting: TableSorting<Obj>;
}

export function useObjectsTable<Obj extends ReferenceObject>(
    config: TableConfig<Obj>,
    getRows: GetRows<Obj>,
    options: TableOptions<Obj>,
    setTableOptions: (newState: TableOptions<Obj>) => void
): UseObjectsTable<Obj> {
    const [state, setState] = React.useState<State<Obj>>(initialState);
    const { search } = options;

    const loadRows = React.useCallback(
        async (sorting: TableSorting<Obj>, pagination: Partial<TablePagination>) => {
            setState(state => ({ ...state, isLoading: true }));
            const paging = { ...initialPagination, ...pagination };
            const res = await getRows(search.trim(), paging, sorting);
            setState({
                rows: res.objects,
                isLoading: false,
                total: res.pager.total,
            });
        },
        [getRows, search]
    );

    const load = React.useCallback(() => {
        loadRows(options.sorting, options.pagination);
    }, [loadRows, options.sorting, options.pagination]);

    // Initial load
    React.useEffect(load, [load]);

    const onChange = React.useCallback(
        (newState: TableState<Obj>) => {
            setTableOptions({
                search: search,
                pagination: newState.pagination,
                sorting: newState.sorting,
            });
        },
        [setTableOptions, search]
    );

    const onChangeSearch = React.useCallback(
        (newValue: string) => {
            setTableOptions({
                ...options,
                pagination: {
                    page: 1,
                    pageSize: options.pagination.pageSize,
                },
                search: newValue,
            });
        },
        [setTableOptions, options]
    );

    return {
        ...config,
        isLoading: state.isLoading,
        rows: state.rows,
        onChange,
        pagination: { ...options.pagination, total: state.total },
        sorting: options.sorting,
        onChangeSearch,
        search: options.search,
        reload: load,
    };
}

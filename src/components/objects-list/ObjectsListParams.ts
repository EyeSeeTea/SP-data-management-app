import React from "react";
import _ from "lodash";
import { isValueInUnionType, fromPairs } from "../../types/utils";
import { TableColumn, TableSorting, ReferenceObject } from "d2-ui-components";
import { Pagination } from "./objects-list-hooks";
import { UseQueryStringsOptions, useUrlParams } from "../../utils/use-url-params";

export interface UrlState<Obj extends ReferenceObject> {
    search: string;
    pagination: Pagination;
    sorting: TableSorting<Obj>;
}

type Columns<Obj extends ReferenceObject> = TableColumn<Obj>[];

type Params = Record<ParamKey, string | undefined>;

export const paramKeys = [
    "search" as const,
    "page" as const,
    "pageSize" as const,
    "sorting" as const,
];

type ParamKey = typeof paramKeys[number];

interface ComponentConfig<Obj extends ReferenceObject> {
    initialUrlState: UrlState<Obj>;
    columns: Columns<Obj>;
}

export function useObjectsListParams<Obj extends ReferenceObject>(
    componentConfig: ComponentConfig<Obj>
) {
    const useQueryStringOptions = React.useMemo<UseQueryStringsOptions<UrlState<Obj>>>(() => {
        return {
            fromParams: (params: string) => queryObjectsListParse(params, componentConfig),
            toParams: (state: UrlState<Obj>) => queryStringify(state, componentConfig),
        };
    }, [componentConfig]);

    return useUrlParams(useQueryStringOptions);
}

function queryStringify<Obj extends ReferenceObject>(
    state: UrlState<Obj>,
    config: ComponentConfig<Obj>
): string {
    const params = getObjectsListParams(state);
    const initialParams = getObjectsListParams(config.initialUrlState);
    return buildQuery(params, initialParams, paramKeys);
}

export function buildQuery<UrlStateKey extends string>(
    params: Record<UrlStateKey, string | undefined>,
    initialParams: Record<UrlStateKey, string | undefined>,
    urlStateKeys: UrlStateKey[]
): string {
    const isParamNotDefault = ([key, value]: [string, unknown]) =>
        value !== undefined &&
        isValueInUnionType(key, urlStateKeys) &&
        params[key] !== initialParams[key];

    return _(params)
        .toPairs()
        .filter(isParamNotDefault)
        .map(([key, value]) => `${key}=${value}`)
        .join("&");
}

export function queryObjectsListParse<Obj extends ReferenceObject>(
    queryString: string,
    config: ComponentConfig<Obj>
): UrlState<Obj> {
    const obj = parseQuery(queryString, paramKeys);

    return {
        search: decodeURIComponent(obj.search || config.initialUrlState.search),
        pagination: {
            page: parseInt(obj.page) || config.initialUrlState.pagination.page,
            pageSize: parseInt(obj.pageSize) || config.initialUrlState.pagination.pageSize,
        },
        sorting: getSorting(config.columns, obj.sorting) || config.initialUrlState.sorting,
    };
}

export function parseQuery<UrlStateKey extends string>(s: string, urlStateKeys: UrlStateKey[]) {
    return fromPairs(
        _(s.replace(/^\?/, "").split("&"))
            .map(part => {
                const [key, value] = part.split("=", 2);
                if (!isValueInUnionType(key, urlStateKeys) || !value) return null;
                return [key, value] as [UrlStateKey, string];
            })
            .compact()
            .value()
    );
}

export function getObjectsListParams<Obj extends ReferenceObject>(state: UrlState<Obj>): Params {
    return {
        search: state.search ? encodeURIComponent(state.search) : undefined,
        page: state.pagination.page.toString(),
        pageSize: state.pagination.pageSize.toString(),
        sorting: state.sorting.field + ":" + state.sorting.order,
    };
}

export function getSorting<Obj extends ReferenceObject>(
    columns: Columns<Obj>,
    s: string | undefined
): TableSorting<Obj> | undefined {
    if (!s) return;
    const [field, direction] = s.split(":", 2);
    if (direction !== "asc" && direction !== "desc") return;
    const sortableColumns = columns.filter(c => c.sortable).map(c => c.name as keyof Obj & string);
    if (!isValueInUnionType(field, sortableColumns)) return;

    return { field, order: direction };
}

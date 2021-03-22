import React from "react";
import { UrlState, ComponentConfig } from "./ProjectsListConfig";
import {
    buildQuery,
    parseQuery,
    getObjectsListParams,
    queryObjectsListParse,
    paramKeys,
} from "../../components/objects-list/ObjectsListParams";
import { UseQueryStringsOptions } from "../../utils/use-url-params";

const urlStateKeys = [
    ...paramKeys,
    "countries" as const,
    "sectors" as const,
    "onlyActive" as const,
];

export function useQueryStringParams(componentConfig: ComponentConfig) {
    return React.useMemo<UseQueryStringsOptions<UrlState>>(() => {
        return {
            fromParams: (params: string) => queryParse(params, componentConfig),
            toParams: (state: UrlState) => queryStringify(state, componentConfig),
        };
    }, [componentConfig]);
}

export function queryStringify(state: UrlState, config: ComponentConfig): string {
    const params = getParams(state);
    const initialParams = getParams(config.initialUrlState);
    return buildQuery(params, initialParams, urlStateKeys);
}

export function queryParse(queryString: string, config: ComponentConfig): UrlState {
    const { initialUrlState } = config;
    const obj = parseQuery(queryString, urlStateKeys);
    const toArray = (s: string | undefined) => (s !== undefined ? s.split(",") : undefined);

    return {
        ...queryObjectsListParse(queryString, config),
        countries: toArray(obj.countries) || initialUrlState.countries,
        sectors: toArray(obj.sectors) || initialUrlState.sectors,
        onlyActive: obj.onlyActive ? obj.onlyActive === "true" : initialUrlState.onlyActive,
    };
}

function getParams(state: UrlState) {
    const fromArray = (xs: string[] | undefined) => (xs ? xs.join(",") : undefined);

    return {
        ...getObjectsListParams(state),
        countries: fromArray(state.countries),
        sectors: fromArray(state.sectors),
        onlyActive: state.onlyActive !== undefined ? state.onlyActive.toString() : undefined,
    };
}

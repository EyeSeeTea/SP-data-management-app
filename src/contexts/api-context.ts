import React, { useContext } from "react";
import { D2Api, D2ApiDefault } from "d2-api";

interface MetadataConfig {
    currentUser: {
        userRoles: string[];
    };
    userRoles: {
        app: string[];
        feedback: string[];
        reportingAnalyst: string[];
        superUser: string[];
        encode: string[];
        analyser: string[];
    };
}

interface Context {
    api: D2Api;
    d2: object;
    config: MetadataConfig;
}
const defaultValue = {
    api: new D2ApiDefault({ baseUrl: "http://localhost:8080" }),
    d2: {},
    config: {
        currentUser: { userRoles: [] },
        userRoles: {
            app: [],
            feedback: [],
            reportingAnalyst: [],
            superUser: [],
            encode: [],
            analyser: [],
        },
    },
};
export const ApiContext = React.createContext<Context>(defaultValue);

export function useD2() {
    return useContext(ApiContext).d2;
}

export function useD2Api() {
    return useContext(ApiContext).api;
}

export function useConfig() {
    return useContext(ApiContext).config;
}

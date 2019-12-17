import { Config } from "../models/Config";
import React, { useContext } from "react";
import { D2Api } from "d2-api";
import User from "../models/user";

interface Context {
    api: D2Api;
    d2: object;
    config: Config;
    currentUser: User;
    isDev: boolean;
}

export type CurrentUser = Context["currentUser"];

export const ApiContext = React.createContext<Context | null>(null);

export function useAppContext() {
    const context = useContext(ApiContext);
    if (context) {
        return context;
    } else {
        throw new Error("Context not found");
    }
}

import { Config } from "../models/Config";
import React, { useContext } from "react";
import { D2Api } from "../types/d2-api";
import User from "../models/user";

export interface AppContext {
    api: D2Api;
    d2: object;
    config: Config;
    currentUser: User;
    isDev: boolean;
}

export type CurrentUser = AppContext["currentUser"];

export const ApiContext = React.createContext<AppContext | null>(null);

export function useAppContext() {
    const context = useContext(ApiContext);
    if (context) {
        return context;
    } else {
        throw new Error("Context not found");
    }
}

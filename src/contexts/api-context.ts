import React, { useContext } from "react";
import { D2Api, D2ApiDefault } from "d2-api";

const defaultApi = new D2ApiDefault({ baseUrl: "http://localhost:8080" });
export const ApiContext = React.createContext<D2Api>(defaultApi);

export function useD2Api() {
    return useContext(ApiContext);
}

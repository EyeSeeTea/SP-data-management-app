import React from "react";
import axios from "axios";
import ReactDOM from "react-dom";
import { init } from "d2";
import i18n from "@dhis2/d2-i18n";
import { Provider } from "@dhis2/app-runtime";
import { D2ApiDefault } from "d2-api";

import App from "./components/app/App";
import "./locales";
import "./utils/lodash-mixins";

async function getBaseUrl() {
    if (process.env.NODE_ENV === "development") {
        const baseUrl = process.env.REACT_APP_DHIS2_BASE_URL || "http://localhost:8080";
        console.info(`[DEV] DHIS2 instance: ${baseUrl}`);
        return baseUrl.replace(/\/*$/, "");
    } else {
        const { data: manifest } = await axios.get("manifest.webapp");
        return manifest.activities.dhis.href;
    }
}

function isLangRTL(code) {
    const langs = ["ar", "fa", "ur"];
    const prefixed = langs.map(c => `${c}-`);
    return langs.includes(code) || prefixed.filter(c => code && code.startsWith(c)).length > 0;
}

function configI18n(userSettings) {
    const uiLocale = userSettings.keyUiLocale;
    i18n.changeLanguage(uiLocale);
    document.documentElement.setAttribute("dir", isLangRTL(uiLocale) ? "rtl" : "ltr");
}

async function main() {
    const baseUrl = await getBaseUrl();
    const d2 = await init({ baseUrl: baseUrl + "/api" });
    const api = new D2ApiDefault({ baseUrl });
    const userSettings = await api.get("/userSettings").getData();
    configI18n(userSettings);
    const config = { baseUrl, apiVersion: "30" };
    try {
        ReactDOM.render(
            <Provider config={config}>
                <App d2={d2} api={api} />
            </Provider>,
            document.getElementById("root")
        );
    } catch (err) {
        console.error(err);
        ReactDOM.render(<div>{err.toString()}</div>, document.getElementById("root"));
    }
}

main();

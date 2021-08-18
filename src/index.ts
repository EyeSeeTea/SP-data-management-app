import React from "react";
import axios from "axios";
import ReactDOM from "react-dom";
// @ts-ignore
import { init } from "d2";
import { Provider } from "@dhis2/app-runtime";

import App from "./components/app/App";
import "./locales";
import "./utils/lodash-mixins";
import { D2Api } from "./types/d2-api";
import i18n from "./locales";

import whyDidYouRender from "@welldone-software/why-did-you-render";

async function getBaseUrl(): Promise<string> {
    if (process.env.NODE_ENV === "development") {
        const baseUrl = `/dhis2`;
        return baseUrl.replace(/\/*$/, "");
    } else {
        const { data: manifest } = await axios.get("manifest.webapp");
        return manifest.activities.dhis.href;
    }
}

function isLangRTL(code: string): boolean {
    const langs = ["ar", "fa", "ur"];
    const prefixed = langs.map(c => `${c}-`);
    return langs.includes(code) || prefixed.filter(c => code && code.startsWith(c)).length > 0;
}

type UserSettings = { keyUiLocale: string };

function configI18n(userSettings: UserSettings) {
    const uiLocale = userSettings.keyUiLocale;
    i18n.changeLanguage(uiLocale);
    document.documentElement.setAttribute("dir", isLangRTL(uiLocale) ? "rtl" : "ltr");
}

async function main() {
    const baseUrl = await getBaseUrl();
    const d2 = await init({ baseUrl: baseUrl + "/api", schemas: [] });
    const api = new D2Api({ baseUrl, backend: "xhr", timeout: 60 * 1000 });
    const userSettings = (await api.get("/userSettings").getData()) as UserSettings;
    configI18n(userSettings);
    const config = { baseUrl, apiVersion: 30 };

    try {
        ReactDOM.render(
            // eslint-disable-next-line react/no-children-prop
            React.createElement(
                Provider,
                { config, children: null },
                React.createElement(App, { d2, api, dhis2Url: baseUrl })
            ),
            document.getElementById("root")
        );
    } catch (err) {
        console.error(err);
        ReactDOM.render(
            React.createElement("div", {}, err.toString()),
            document.getElementById("root")
        );
    }
}

if (process.env.REACT_APP_TRACK_RERENDERS) {
    console.debug("[whyDidYouRender] Track re-renders");
    whyDidYouRender(React, {
        trackAllPureComponents: true,
    });
}

main();

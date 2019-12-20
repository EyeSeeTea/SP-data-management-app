import React, { useEffect, useState } from "react";
//@ts-ignore
import { HeaderBar } from "@dhis2/ui-widgets";
import { MuiThemeProvider } from "@material-ui/core/styles";
//@ts-ignore
import OldMuiThemeProvider from "material-ui/styles/MuiThemeProvider";
//@ts-ignore
import { useDataQuery, useConfig } from "@dhis2/app-runtime";
import _ from "lodash";
//@ts-ignore
import i18n from "@dhis2/d2-i18n";
//@ts-ignore
import { init } from "d2";
import { SnackbarProvider } from "d2-ui-components";
import { D2ApiDefault } from "d2-api";

import "./App.css";
import { muiTheme } from "./themes/dhis2.theme";
import muiThemeLegacy from "./themes/dhis2-legacy.theme";
import Root from "../../pages/root/Root";
import Share from "../share/Share";
import { ApiContext, AppContext } from "../../contexts/api-context";
import { getConfig } from "../../models/Config";
import User from "../../models/user";
import { LinearProgress } from "@material-ui/core";

interface AppConfig {
    appKey: string;
    appearance: {
        showShareButton: boolean;
    };
    feedback: {
        token: string[];
        createIssue: boolean;
        sendToDhis2UserGroups: string[];
        issues: {
            repository: string;
            title: string;
            body: string;
        };
        snapshots: {
            repository: string;
            branch: string;
        };
        feedbackOptions: {};
    };
}

type D2 = object;

type AppWindow = Window & {
    $: {
        feedbackDhis2: (
            d2: D2,
            appKey: string,
            appConfig: AppConfig["feedback"]["feedbackOptions"]
        ) => void;
    };
};

function isLangRTL(code: string): boolean {
    const langs = ["ar", "fa", "ur"];
    const prefixed = langs.map(c => `${c}-`);
    return _(langs).includes(code) || prefixed.filter(c => code && code.startsWith(c)).length > 0;
}

function initFeedbackTool(d2: D2, appConfig: AppConfig): void {
    const appKey = _(appConfig).get("appKey");

    if (appConfig && appConfig.feedback) {
        const feedbackOptions = {
            ...appConfig.feedback,
            i18nPath: "feedback-tool/i18n",
        };
        ((window as unknown) as AppWindow).$.feedbackDhis2(d2, appKey, feedbackOptions);
    }
}

function configI18n(userSettings: { keyUiLocale: string }) {
    const uiLocale = userSettings.keyUiLocale;
    i18n.changeLanguage(uiLocale);
    document.documentElement.setAttribute("dir", isLangRTL(uiLocale) ? "rtl" : "ltr");
}

const App = () => {
    const { baseUrl } = useConfig();
    const [appContext, setAppContext] = useState<AppContext | null>(null);

    const [showShareButton, setShowShareButton] = useState(false);
    const { loading, error, data } = useDataQuery({
        userSettings: { resource: "/userSettings" },
    });
    useEffect(() => {
        const run = async () => {
            const appConfig = await fetch("app-config.json", {
                credentials: "same-origin",
            }).then(res => res.json());
            const d2 = await init({ baseUrl: baseUrl + "/api" });
            const api = new D2ApiDefault({ baseUrl });
            const config = await getConfig(api);

            configI18n(data.userSettings);
            const currentUser = new User(config);
            const appContext: AppContext = { d2, api, config, currentUser };
            setAppContext(appContext);
            Object.assign(window, { pm: appContext });

            setShowShareButton(_(appConfig).get("appearance.showShareButton") || false);
            const isFeedbackRole =
                _.intersection(
                    config.currentUser.userRoles.map(userRole => userRole.name),
                    config.base.userRoles.feedback
                ).length > 0;
            if (isFeedbackRole) {
                initFeedbackTool(d2, appConfig);
            }
        };

        if (data) run();
    }, [data]);

    if (error) {
        return (
            <h3 style={{ margin: 20 }}>
                <a rel="noopener noreferrer" target="_blank" href={baseUrl}>
                    Login
                </a>
                {` ${baseUrl}`}
            </h3>
        );
    } else if (loading || !appContext) {
        return (
            <div style={{ margin: 20 }}>
                <h3>Connecting to {baseUrl}...</h3>
                <LinearProgress />
            </div>
        );
    } else {
        return (
            <MuiThemeProvider theme={muiTheme}>
                <OldMuiThemeProvider muiTheme={muiThemeLegacy}>
                    <SnackbarProvider>
                        <HeaderBar appName={"Project Monitoring"} />

                        <div id="app" className="content">
                            <ApiContext.Provider value={appContext}>
                                <Root />
                            </ApiContext.Provider>
                        </div>

                        <Share visible={showShareButton} />
                    </SnackbarProvider>
                </OldMuiThemeProvider>
            </MuiThemeProvider>
        );
    }
};

export default App;

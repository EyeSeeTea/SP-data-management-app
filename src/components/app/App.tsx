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
import { SnackbarProvider, LoadingProvider } from "@eyeseetea/d2-ui-components";
import { D2Api } from "../../types/d2-api";

import "./App.css";
import { muiTheme } from "./themes/dhis2.theme";
import muiThemeLegacy from "./themes/dhis2-legacy.theme";
import Root from "../../pages/root/Root";
import Share from "../share/Share";
import { ApiContext, AppContext } from "../../contexts/api-context";
import { getConfig } from "../../models/Config";
import User from "../../models/user";
import { LinearProgress } from "@material-ui/core";
import Migrations from "../migrations/Migrations";
import { useMigrations } from "../migrations/hooks";

const appKey = "data-management-app";

export interface AppConfig {
    appKey: string;
    appearance: {
        showShareButton: boolean;
    };
    app: {
        notifyEmailOnProjectSave: string[];
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

const settingsQuery = { userSettings: { resource: "/userSettings" } };

interface AppProps {
    api: D2Api;
    d2: object;
}

const App: React.FC<AppProps> = props => {
    const { api, d2 } = props;
    const { baseUrl } = useConfig();
    const [appContext, setAppContext] = useState<AppContext | null>(null);
    const [showShareButton, setShowShareButton] = useState(false);
    const { loading, error, data } = useDataQuery(settingsQuery);
    const isDev = _.last(window.location.hash.split("#")) === "dev";
    const migrations = useMigrations(api, appKey);
    const [loadError, setLoadError] = useState<string>();

    useEffect(() => {
        const run = async () => {
            const appConfigUrl = process.env.PUBLIC_URL + "/app-config.json";
            const appConfig = await fetch(appConfigUrl, {
                credentials: "same-origin",
            }).then(res => res.json());
            const config = await getConfig(api);
            const currentUser = new User(config);
            const isTest = process.env.REACT_APP_CYPRESS === "true";
            const appContext = { d2, api, config, currentUser, isDev, isTest, appConfig };
            setAppContext(appContext);

            Object.assign(window, { dm: appContext });

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

        if (data && migrations.state.type === "checked") {
            run().catch(err => setLoadError(err.message));
        }
    }, [api, d2, data, isDev, migrations]);

    if (loadError) {
        return <div>Cannot load app: {loadError}</div>;
    }

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
                {migrations.state.type === "checked" ? (
                    <LinearProgress />
                ) : (
                    <Migrations migrations={migrations} />
                )}
            </div>
        );
    } else {
        return (
            <MuiThemeProvider theme={muiTheme}>
                <OldMuiThemeProvider muiTheme={muiThemeLegacy}>
                    <LoadingProvider>
                        <SnackbarProvider>
                            <HeaderBar appName={"Data Management"} />

                            <div id="app" className="content">
                                <ApiContext.Provider value={appContext}>
                                    <Root />
                                </ApiContext.Provider>
                            </div>

                            <Share visible={showShareButton} />
                        </SnackbarProvider>
                    </LoadingProvider>
                </OldMuiThemeProvider>
            </MuiThemeProvider>
        );
    }
};

export default React.memo(App);

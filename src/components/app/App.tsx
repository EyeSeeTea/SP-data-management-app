import React, { useEffect, useState } from "react";
//@ts-ignore
import { HeaderBar } from "@dhis2/ui";
import { MuiThemeProvider } from "@material-ui/core/styles";
//@ts-ignore
import OldMuiThemeProvider from "material-ui/styles/MuiThemeProvider";
//@ts-ignore
import { useDataQuery, useConfig } from "@dhis2/app-runtime";
import _ from "lodash";
//@ts-ignore
import { SnackbarProvider, LoadingProvider } from "@eyeseetea/d2-ui-components";
import { Feedback } from "@eyeseetea/feedback-component";
import { D2Api } from "../../types/d2-api";

import "./App.css";
import { muiTheme } from "./themes/dhis2.theme";
import muiThemeLegacy from "./themes/dhis2-legacy.theme";
import Root from "../../pages/root/Root";
import Share from "../share/Share";
import { ApiContext, AppContext } from "../../contexts/api-context";
import { getConfig } from "../../models/Config";
import User from "../../models/user";
import { createGenerateClassName, LinearProgress, StylesProvider } from "@material-ui/core";
import Migrations from "../migrations/Migrations";
import { useMigrations } from "../migrations/hooks";
import { appConfig } from "../../app-config";

const settingsQuery = { userSettings: { resource: "/userSettings" } };

interface AppProps {
    api: D2Api;
    d2: object;
    dhis2Url: string;
}

const App: React.FC<AppProps> = props => {
    const { api, d2, dhis2Url } = props;
    const { baseUrl } = useConfig();
    const [appContext, setAppContext] = useState<AppContext | null>(null);
    const [showShareButton, setShowShareButton] = useState(false);
    const { loading, error, data } = useDataQuery(settingsQuery);
    const isDev = _.last(window.location.hash.split("#")) === "dev";
    const migrations = useMigrations(api, appConfig.appKey);
    const [loadError, setLoadError] = useState<string>();
    const [username, setUsername] = useState("");

    useEffect(() => {
        const run = async () => {
            const config = await getConfig(api);
            const currentUser = new User(config);
            const isTest = process.env.REACT_APP_CYPRESS === "true";
            const appContext = { d2, api, config, currentUser, isDev, isTest, appConfig, dhis2Url };
            setUsername(currentUser.data.username);
            setAppContext(appContext);

            Object.assign(window, { dm: appContext });

            setShowShareButton(_(appConfig).get("appearance.showShareButton") || false);
        };

        if (data && migrations.state.type === "checked") {
            run().catch(err => setLoadError(err.message));
        }
    }, [api, d2, data, isDev, dhis2Url, migrations]);

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
            <StylesProvider generateClassName={generateClassName}>
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
                                <Feedback options={appConfig.feedback} username={username} />
                            </SnackbarProvider>
                        </LoadingProvider>
                    </OldMuiThemeProvider>
                </MuiThemeProvider>
            </StylesProvider>
        );
    }
};

const generateClassName = createGenerateClassName({
    seed: "dm",
});

export default React.memo(App);

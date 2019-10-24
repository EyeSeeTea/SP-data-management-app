import React from "react";
import { Route, Switch, HashRouter } from "react-router-dom";
import LandingPage from "../landing-page/LandingPage";

const Root = () => {
    return (
        <HashRouter>
            <Switch>
                <Route render={() => <LandingPage />} />
            </Switch>
        </HashRouter>
    );
};

export default Root;

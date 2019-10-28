import React from "react";
import { Route, Switch, HashRouter } from "react-router-dom";
import LandingPage from "../landing-page/LandingPage";
import ProjectsList from "../projects-list/ProjectsList";

const Root = () => {
    return (
        <HashRouter>
            <Switch>
                <Route path="/projects" render={() => <ProjectsList />} />
                <Route render={() => <LandingPage />} />
            </Switch>
        </HashRouter>
    );
};

export default Root;

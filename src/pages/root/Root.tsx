import React from "react";
import { Route, Switch, HashRouter } from "react-router-dom";
import LandingPage from "../landing-page/LandingPage";
import ProjectsList from "../projects-list/ProjectsList";
import { generateUrl } from "../../router";
import ProjectWizard from "../project-wizard/ProjectWizard";

const Root = () => {
    return (
        <HashRouter>
            <Switch>
                <Route path={generateUrl("projects.new")} render={() => <ProjectWizard />} />
                <Route path={generateUrl("projects")} render={() => <ProjectsList />} />
                <Route render={() => <LandingPage />} />
            </Switch>
        </HashRouter>
    );
};

export default Root;

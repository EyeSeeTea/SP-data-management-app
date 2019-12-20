import React from "react";
import { Route, Switch, HashRouter } from "react-router-dom";

import ProjectsList from "../projects-list/ProjectsList";
import Report from "../report/Report";
import Dashboard from "../dashboard/Dashboard";
import { generateUrl } from "../../router";
import ProjectWizard from "../project-wizard/ProjectWizard";
import DataValues from "../data-values/DataValues";

const Root = () => {
    const idParam = { id: ":id" };
    return (
        <HashRouter>
            <Switch>
                <Route path={generateUrl("projects.new")} render={() => <ProjectWizard />} />
                <Route path={generateUrl("report")} render={() => <Report />} />
                <Route
                    path={generateUrl("actualValues", idParam)}
                    render={() => <DataValues type="actual" />}
                />
                <Route
                    path={generateUrl("targetValues", idParam)}
                    render={() => <DataValues type="target" />}
                />
                <Route path={generateUrl("dashboard", idParam)} render={() => <Dashboard />} />
                <Route path={generateUrl("dashboards")} render={() => <Dashboard />} />
                <Route render={() => <ProjectsList />} />
            </Switch>
        </HashRouter>
    );
};

export default Root;

import React from "react";
import { Route, Switch, HashRouter } from "react-router-dom";

import MerReport from "../report/MerReport";
import Dashboard from "../dashboard/Dashboard";
import { generateUrl } from "../../router";
import ProjectWizard from "../project-wizard/ProjectWizard";
import DataValues from "../data-values/DataValues";
import DataApproval from "../data-approval/DataApproval";
import List from "../list/List";

const Root = () => {
    const idParam = { id: ":id" };
    return (
        <HashRouter>
            <Switch>
                <Route
                    path={generateUrl("projects.new")}
                    render={() => <ProjectWizard action={{ type: "create" }} />}
                />
                <Route
                    path={generateUrl("projects.edit", idParam)}
                    render={props => (
                        <ProjectWizard action={{ type: "edit", id: props.match.params.id }} />
                    )}
                />
                <Route path={generateUrl("report")} render={() => <MerReport />} />
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
                <Route
                    path={generateUrl("dataApproval", idParam)}
                    render={() => <DataApproval />}
                />
                <Route render={() => <List />} />
            </Switch>
        </HashRouter>
    );
};

export default React.memo(Root);

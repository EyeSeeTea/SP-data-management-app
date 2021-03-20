import React from "react";
import { Route, Switch, HashRouter } from "react-router-dom";

import MerReport from "../report/MerReport";
import { generateUrl } from "../../router";
import ProjectWizard from "../project-wizard/ProjectWizard";
import DataValues from "../data-values/DataValues";
import DataApproval from "../data-approval/DataApproval";
import CountriesList from "../../components/countries-list/CountriesList";
import ProjectsList from "../projects-list/ProjectsList";
import ProjectDashboard from "../dashboard/ProjectDashboard";
import CountryDashboard from "../dashboard/CountryDashboard";
import AwardNumberDashboard from "../dashboard/AwardNumberDashboard";

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
                        //@ts-ignore
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
                <Route
                    path={generateUrl("projectDashboard", idParam)}
                    render={() => <ProjectDashboard />}
                />
                <Route
                    path={generateUrl("awardNumberDashboard", idParam)}
                    render={() => <AwardNumberDashboard />}
                />
                <Route
                    path={generateUrl("countryDashboard", idParam)}
                    render={() => <CountryDashboard />}
                />
                <Route
                    path={generateUrl("dataApproval", idParam)}
                    render={() => <DataApproval />}
                />
                <Route path={generateUrl("countries")} render={() => <CountriesList />} />

                <Route render={() => <ProjectsList />} />
            </Switch>
        </HashRouter>
    );
};

export default React.memo(Root);

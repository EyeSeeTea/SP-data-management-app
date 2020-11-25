import React from "react";
import Dashboard from "../../components/dashboard/Dashboard";
import {
    DashboardObj,
    useDashboardFromParams,
    GetDashboard,
} from "../../components/dashboard/dashboard-hooks";
import { Loader } from "../../components/loader/Loader";
import { generateUrl } from "../../router";
import Project from "../../models/Project";

const ProjectDashboard: React.FC = () => {
    const state = useDashboardFromParams(getDashboard);

    return (
        <Loader<DashboardObj> state={state}>
            {dashboard => (
                <Dashboard
                    id={dashboard.id}
                    name={dashboard.name}
                    backUrl={generateUrl("projects")}
                />
            )}
        </Loader>
    );
};

const getDashboard: GetDashboard = async (api, config, projectId) => {
    const project = await Project.get(api, config, projectId);
    const dashboard = project?.dashboard;
    return dashboard ? { id: dashboard.id, name: project.name } : undefined;
};

export default React.memo(ProjectDashboard);

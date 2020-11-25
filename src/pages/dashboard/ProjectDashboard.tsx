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
import i18n from "../../locales";

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
    return dashboard
        ? { type: "success", data: { id: dashboard.id, name: project.name } }
        : { type: "error", message: i18n.t("Cannot get project") };
};

export default React.memo(ProjectDashboard);

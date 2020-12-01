import React from "react";
import Dashboard from "../../components/dashboard/Dashboard";
import {
    DashboardObj,
    useDashboardFromParams,
    GetDashboard,
} from "../../components/dashboard/dashboard-hooks";
import { Loader } from "../../components/loader/Loader";
import { generateUrl } from "../../router";
import i18n from "../../locales";
import { getProjectDashboard } from "../../models/ProjectDashboard";

const ProjectDashboard: React.FC = () => {
    const state = useDashboardFromParams(getDashboard);
    const backUrl = generateUrl("projects");

    return (
        <Loader<DashboardObj> state={state}>
            {dashboard => (
                <Dashboard
                    id={dashboard.id}
                    name={i18n.t("Project dashboard: ") + dashboard.name}
                    backUrl={backUrl}
                />
            )}
        </Loader>
    );
};

const getDashboard: GetDashboard = async (api, config, projectId) => {
    const res = await getProjectDashboard(api, config, projectId);
    return res.type === "success"
        ? { type: "success", data: res.data }
        : { type: "error", message: i18n.t("Cannot get project dashboard") + ": " + res.message };
};

export default React.memo(ProjectDashboard);

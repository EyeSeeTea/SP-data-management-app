import React from "react";
import Dashboard from "../../components/dashboard/Dashboard";
import { DashboardObj, useDashboardFromParams } from "../../components/dashboard/dashboard-hooks";
import { Loader } from "../../components/loader/Loader";
import { generateUrl } from "../../router";
import i18n from "../../locales";
import { getProjectDashboard } from "../../models/ProjectDashboard";

const ProjectDashboard: React.FC = () => {
    const state = useDashboardFromParams(getProjectDashboard);
    const backUrl = generateUrl("projects");

    return (
        <Loader<DashboardObj> state={state} onErrorGoTo={backUrl}>
            {dashboard => (
                <Dashboard
                    id={dashboard.id}
                    name={i18n.t("Project dashboard") + ": " + dashboard.name}
                    backUrl={backUrl}
                />
            )}
        </Loader>
    );
};

export default React.memo(ProjectDashboard);

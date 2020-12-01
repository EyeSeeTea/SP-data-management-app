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

const AwardNumberDashboard: React.FC = () => {
    const state = useDashboardFromParams(getDashboard);
    const backUrl = generateUrl("projects");

    // TODO: on error, snackbar BUT ALSO go to backUrl
    return (
        <Loader<DashboardObj> state={state}>
            {dashboard => (
                <Dashboard
                    id={dashboard.id}
                    name={i18n.t("Award Number Dashboard: ") + dashboard.name}
                    backUrl={backUrl}
                />
            )}
        </Loader>
    );
};

const getDashboard: GetDashboard = async (api, config, projectId) => {
    const res = await Project.get(api, config, projectId)
        .then(project =>
            project.dashboard.awardNumber
                ? { type: "success" as const, data: project.dashboard.awardNumber }
                : { type: "error" as const, message: "No dashboard found" }
        )
        .catch(err => ({ type: "error" as const, message: err.message }));

    return res.type === "success"
        ? { type: "success", data: res.data }
        : { type: "error", message: res.message };
};

export default React.memo(AwardNumberDashboard);

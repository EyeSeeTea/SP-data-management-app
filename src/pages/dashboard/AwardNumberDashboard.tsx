import React from "react";
import Dashboard from "../../components/dashboard/Dashboard";
import { DashboardObj, useDashboardFromParams } from "../../components/dashboard/dashboard-hooks";
import { Loader } from "../../components/loader/Loader";
import { generateUrl } from "../../router";
import i18n from "../../locales";
import { getAwardNumberDashboard } from "../../models/ProjectDashboard";

const AwardNumberDashboard: React.FC = () => {
    const state = useDashboardFromParams(getAwardNumberDashboard);
    const backUrl = generateUrl("projects");

    return (
        <Loader<DashboardObj> state={state} onErrorGoTo={backUrl}>
            {dashboard => (
                <Dashboard
                    id={dashboard.id}
                    name={i18n.t("Award Number Dashboard") + ": " + dashboard.name}
                    backUrl={backUrl}
                />
            )}
        </Loader>
    );
};

export default React.memo(AwardNumberDashboard);

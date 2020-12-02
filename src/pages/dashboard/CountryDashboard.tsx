import React from "react";
import Dashboard from "../../components/dashboard/Dashboard";
import { DashboardObj, useDashboardFromParams } from "../../components/dashboard/dashboard-hooks";
import { Loader } from "../../components/loader/Loader";
import { generateUrl } from "../../router";
import { getCountryDashboard } from "../../models/Country";
import i18n from "../../locales";

const CountryDashboard: React.FC = () => {
    const state = useDashboardFromParams(getCountryDashboard);
    const backUrl = generateUrl("countries");

    return (
        <Loader<DashboardObj> state={state} onErrorGoTo={backUrl}>
            {dashboard => (
                <Dashboard
                    id={dashboard.id}
                    name={i18n.t("Country dashboard") + ": " + dashboard.name}
                    backUrl={backUrl}
                />
            )}
        </Loader>
    );
};

export default React.memo(CountryDashboard);

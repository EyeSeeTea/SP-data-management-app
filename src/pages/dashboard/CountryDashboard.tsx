import React from "react";
import Dashboard from "../../components/dashboard/Dashboard";
import {
    DashboardObj,
    useDashboardFromParams,
    GetDashboard,
} from "../../components/dashboard/dashboard-hooks";
import { Loader } from "../../components/loader/Loader";
import { generateUrl } from "../../router";
import { getCountry } from "../../models/Country";

const CountryDashboard: React.FC = () => {
    const state = useDashboardFromParams(getDashboard);

    return (
        <Loader<DashboardObj> state={state}>
            {country => (
                <Dashboard id={country.id} name={country.name} backUrl={generateUrl("countries")} />
            )}
        </Loader>
    );
};

const getDashboard: GetDashboard = async (api, config, countryId) => {
    const country = await getCountry(api, config, countryId);
    return country && country.dashboard
        ? { id: country.dashboard.id, name: country.name }
        : undefined;
};

export default React.memo(CountryDashboard);

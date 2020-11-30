import React from "react";
import Dashboard from "../../components/dashboard/Dashboard";
import {
    DashboardObj,
    useDashboardFromParams,
    GetDashboard,
} from "../../components/dashboard/dashboard-hooks";
import { Loader } from "../../components/loader/Loader";
import { generateUrl } from "../../router";
import { getCountryDashboard } from "../../models/Country";
import i18n from "../../locales";

const CountryDashboard: React.FC = () => {
    const state = useDashboardFromParams(getDashboard);
    const backUrl = generateUrl("countries");

    return (
        <Loader<DashboardObj> state={state}>
            {country => <Dashboard id={country.id} name={country.name} backUrl={backUrl} />}
        </Loader>
    );
};

const getDashboard: GetDashboard = async (api, config, countryId) => {
    const res = await getCountryDashboard({ api, config, countryId });
    return res.type === "success"
        ? { type: "success", data: res.data }
        : { type: "error", message: i18n.t("Cannot get country dashboard") + ": " + res.message };
};

export default React.memo(CountryDashboard);

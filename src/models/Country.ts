import { Id, D2Api } from "../types/d2-api";
import { Config } from "./Config";
import { Maybe } from "../types/utils";
import CountryDashboard from "./CountryDashboard";
import i18n from "../locales";
import Dashboard from "../components/dashboard/Dashboard";
import { Response } from "./Response";

export interface Country {
    id: Id;
    name: string;
    dashboard: Maybe<Dashboard>;
}

export interface Dashboard {
    id: Id;
    name: string;
}

export interface CountryWithDashboard extends Country {
    dashboard: Dashboard;
}

export async function getCountry(
    api: D2Api,
    config: Config,
    countryId: Id
): Promise<Maybe<Country>> {
    const { organisationUnits } = await api.metadata
        .get({
            organisationUnits: {
                fields: {
                    id: true,
                    name: true,
                    attributeValues: { attribute: { id: true }, value: true },
                },
                filter: { id: { eq: countryId } },
            },
        })
        .getData();
    const d2Country = organisationUnits[0];
    if (!d2Country) return;

    const attributeValue = d2Country.attributeValues.find(
        av => av.attribute.id === config.attributes.projectDashboard.id
    );

    return {
        id: d2Country.id,
        name: d2Country.name,
        dashboard: attributeValue ? { id: attributeValue.value, name: d2Country.name } : undefined,
    };
}

export async function getCountryDashboard(
    api: D2Api,
    config: Config,
    countryId: Id
): Promise<Response<Dashboard>> {
    const country = await getCountry(api, config, countryId);

    if (!country) {
        return { type: "error", message: i18n.t(`Country not found: ${countryId}`) };
    } else if (country.dashboard) {
        return { type: "success", data: country.dashboard };
    } else {
        const countryDashboard = await CountryDashboard.build(api, config, country.id);
        const metadata = countryDashboard.generate();
        const dashboard = metadata.dashboards[0];
        if (!dashboard) return { type: "error", message: "Error generating dashboard" };

        const response = await api.metadata
            .post(metadata)
            .getData()
            .catch(_err => null);
        const newDashboard = { id: dashboard.id, name: dashboard.name };
        const updateSuccessful = response && response.status === "OK";

        if (!updateSuccessful) {
            return { type: "error", message: i18n.t("Error saving dashboard") };
        } else {
            return { type: "success", data: newDashboard };
        }
    }
}

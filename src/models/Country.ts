import { Id, Ref, D2Api } from "../types/d2-api";
import { Config } from "./Config";
import { Maybe } from "../types/utils";

export interface Country {
    id: Id;
    name: string;
    dashboard: Ref;
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
    if (!attributeValue) return;

    return {
        id: d2Country.id,
        name: d2Country.name,
        dashboard: { id: attributeValue.value },
    };
}

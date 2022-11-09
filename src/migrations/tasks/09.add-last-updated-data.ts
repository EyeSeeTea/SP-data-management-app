import { baseConfig } from "../../models/Config";
import { D2Api } from "../../types/d2-api";
import { addAttributeValueToObj } from "../../models/Attributes";
import { Debug, Migration } from "../types";
import { post } from "./common";

class AddLastUpdatedDataMigration {
    constructor(private api: D2Api, private debug: Debug) {}

    async execute() {
        await this.updateOrgUnits();
    }

    async updateOrgUnits() {
        const { organisationUnits, attributes } = await this.api.metadata
            .get({
                organisationUnits: {
                    fields: { $owner: true },
                    filter: { level: { eq: baseConfig.orgUnits.levelForCountries.toString() } },
                },
                attributes: {
                    fields: { id: true, code: true },
                    filter: { code: { eq: baseConfig.attributes.lastUpdatedData } },
                },
            })
            .getData();

        const orgUnitAttribute = attributes[0];

        const orgUnitsUpdated = organisationUnits.map(organisationUnit =>
            addAttributeValueToObj(organisationUnit, {
                attribute: orgUnitAttribute,
                value: "",
            })
        );

        await post(this.api, this.debug, { organisationUnits: orgUnitsUpdated });
    }
}

const migration: Migration = {
    name: "Add last updated data",
    migrate: async (api: D2Api, debug: Debug) =>
        new AddLastUpdatedDataMigration(api, debug).execute(),
};

export default migration;

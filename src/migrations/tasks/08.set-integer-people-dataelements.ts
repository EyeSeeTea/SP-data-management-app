import { getConfig } from "../../models/Config";
import { D2Api, D2DataElement, PartialPersistedModel } from "../../types/d2-api";
import { Debug, Migration } from "../types";
import { post } from "./common";

class MigrationSetIntegerPeopleDataElements {
    constructor(private api: D2Api, private debug: Debug) {}

    async execute() {
        const config = await getConfig(this.api);
        const peopleGroupCode = config.base.dataElementGroups.people;

        const { dataElements } = await this.api.metadata
            .get({
                dataElements: {
                    fields: { $owner: true },
                    filter: { "dataElementGroups.code": { eq: peopleGroupCode } },
                },
            })
            .getData();

        const dataElementsUpdated = dataElements.map((de): PartialPersistedModel<D2DataElement> => {
            return { ...de, valueType: "INTEGER_ZERO_OR_POSITIVE" };
        });

        await post(this.api, this.debug, { dataElements: dataElementsUpdated });
    }
}

const migration: Migration = {
    name: "Set people data elements value type to postitive or zero integer",
    migrate: async (api: D2Api, debug: Debug) =>
        new MigrationSetIntegerPeopleDataElements(api, debug).execute(),
};

export default migration;

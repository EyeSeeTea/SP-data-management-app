import { D2Api, D2Payload, Id } from "../../types/d2-api";
import { Debug, Migration } from "../types";
import { post } from "./common";
import { getUid } from "../../utils/dhis2";

class AddLastUpdatedDataMigration {
    constructor(private api: D2Api, private debug: Debug) {}

    private async post<Payload extends D2Payload>(payload: Payload) {
        await post(this.api, this.debug, payload);
    }

    async execute() {
        await this.createAttributeForOrgUnitLastUpdated();
    }

    async createAttributeForOrgUnitLastUpdated() {
        this.debug(
            "Create the attribute metadata to store last update data for organisation units"
        );
        return this.post({
            attributes: [
                {
                    id: getId("attributes", "last-updated-org-unit"),
                    name: "Last Updated Data",
                    code: "DM_LAST_UPDATED_DATA",
                    valueType: "DATETIME",
                    dataSetAttribute: true,
                },
            ],
        });
    }
}

function getId(model: string, key: string): Id {
    return getUid(model + "-", key);
}

const migration: Migration = {
    name: "Create the attribute metadata to store last update data for organisation units",
    migrate: async (api: D2Api, debug: Debug) =>
        new AddLastUpdatedDataMigration(api, debug).execute(),
};

export default migration;

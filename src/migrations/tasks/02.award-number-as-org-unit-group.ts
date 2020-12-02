import { getConfig } from "../../models/Config";
import { D2Api } from "../../types/d2-api";
import { Debug, Migration } from "../types";
import { checkCurrentUserIsSuperadmin } from "./permissions";

async function setupAwardNumberMetadata(api: D2Api, _debug: Debug): Promise<void> {
    const config = await getConfig(api);

    checkCurrentUserIsSuperadmin(config);

    // TODO:
    // Create orgUnitGroupSet + attribute + add permission to roles
}

const migration: Migration = {
    name: "Setup project awardNumber metadata",
    migrate: setupAwardNumberMetadata,
};

export default migration;

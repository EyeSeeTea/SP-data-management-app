import { D2Api, D2UserAuthorityGroup } from "../../types/d2-api";
import { Debug, Migration } from "../types";
import { getUid } from "../../utils/dhis2";
import { post } from "./common";

class AddRoleMerApproverMigration {
    constructor(private api: D2Api, private debug: Debug) {}

    async execute() {
        await this.createUserRole();
    }

    async createUserRole() {
        const role: Partial<D2UserAuthorityGroup> = {
            id: getUid("userRole", "mer-approver"),
            name: "MER Approver",
            authorities: [
                "M_dhis-web-interpretation",
                "M_dhis-web-pivot",
                "M_dhis-web-messaging",
                "M_Data_Management_App",
                "M_dhis-web-data-visualizer",
                "F_DATASET_PUBLIC_ADD",
                "M_dhis-web-dashboard",
                "F_SEND_EMAIL",
                "M_dhis-web-visualizer",
            ],
        };
        await post(this.api, this.debug, { userRoles: [role] });
    }
}

const migration: Migration = {
    name: "Add role MER Approver",
    migrate: async (api: D2Api, debug: Debug) =>
        new AddRoleMerApproverMigration(api, debug).execute(),
};

export default migration;

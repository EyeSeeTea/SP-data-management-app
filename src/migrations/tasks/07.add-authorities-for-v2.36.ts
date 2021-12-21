import _ from "lodash";
import { D2Api } from "../../types/d2-api";
import { Debug, Migration } from "../types";
import { post } from "./common";

const newAuthorities = [
    // Create/save project
    "F_USER_VIEW",
    "F_METADATA_EXPORT",

    // Data approval
    "M_dhis-web-approval",
    "F_DATA_APPROVAL_WORKFLOW",
    "F_DATA_APPROVAL_LEVEL",
];

class addAuthoritiesForVersion236 {
    constructor(private api: D2Api, private debug: Debug) {}

    async execute() {
        await this.addAuthoritiesToRoles();
    }

    async addAuthoritiesToRoles() {
        this.debug("Get user roles");

        const { userRoles } = await this.api.metadata
            .get({ userRoles: { fields: { $owner: true } } })
            .getData();

        const userRolesByName = _.keyBy(userRoles, userRole => userRole.name);
        const dataReviewerRole = _(userRolesByName).getOrFail("Data Reviewer");
        const adminRole = _(userRolesByName).getOrFail("DM Admin");

        const dataReviewerRoleUpdated = {
            ...dataReviewerRole,
            authorities: _.union(dataReviewerRole.authorities, newAuthorities),
        };

        const adminRoleUpdated = {
            ...adminRole,
            authorities: _.union(adminRole.authorities, newAuthorities),
        };

        this.debug("Post updated dataReviewer/admin roles");
        const payload = { userRoles: [dataReviewerRoleUpdated, adminRoleUpdated] };
        await post(this.api, this.debug, payload);
    }
}

const migration: Migration = {
    name: "Add new authorities required by migration to DHIS 2.36",
    migrate: async (api: D2Api, debug: Debug) =>
        new addAuthoritiesForVersion236(api, debug).execute(),
};

export default migration;

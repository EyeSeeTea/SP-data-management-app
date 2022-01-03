import _ from "lodash";
import { addAttributeValueToObj } from "../../models/Attributes";
import { baseConfig } from "../../models/Config";
import { D2Api } from "../../types/d2-api";
import { Debug, Migration } from "../types";
import { error, post } from "./common";

const newAuthoritiesForReviewer = [
    // Create/save project
    "F_USER_VIEW",
    "F_METADATA_EXPORT",
    "F_VISUALIZATION_PUBLIC_ADD",

    // Data approval
    "M_dhis-web-approval",
    "F_DATA_APPROVAL_WORKFLOW",
    "F_DATA_APPROVAL_LEVEL",
];

const newAuthoritiesForMERApprover = [
    "F_ORGANISATIONUNIT_ADD",
    "F_DASHBOARD_PUBLIC_ADD",
    "F_VISUALIZATION_PUBLIC_ADD",
];

class MigrationTo236 {
    constructor(private api: D2Api, private debug: Debug) {}

    async execute() {
        await this.addAuthoritiesToRoles();
        await this.clearCountryDashboards();
    }

    async clearCountryDashboards() {
        // Country dashboard will be regenerated on next access (project dashboard are always re-generated)
        this.debug("Clear country dashboard relationship so they are regenerated");

        const { organisationUnits: countries, attributes } = await this.api.metadata
            .get({
                organisationUnits: {
                    fields: { $owner: true },
                    filter: { level: { eq: baseConfig.orgUnits.levelForCountries.toString() } },
                },
                attributes: {
                    fields: { id: true, code: true },
                    filter: { code: { eq: baseConfig.attributes.projectDashboard } },
                },
            })
            .getData();

        const countryDashboardAttribute = attributes[0];
        if (!countryDashboardAttribute) error("Cannot get country dashbaord attribute");

        const countriesUpdated = countries.map(country =>
            addAttributeValueToObj(country, { attribute: countryDashboardAttribute, value: "" })
        );

        await post(this.api, this.debug, { organisationUnits: countriesUpdated });
    }

    async addAuthoritiesToRoles() {
        this.debug("Add new required authorities to user roles");

        this.debug("Get user roles");
        const { userRoles } = await this.api.metadata
            .get({ userRoles: { fields: { $owner: true } } })
            .getData();

        const userRolesByName = _.keyBy(userRoles, userRole => userRole.name);
        const dataReviewerRole = _(userRolesByName).getOrFail("Data Reviewer");
        const merApproverRole = _(userRolesByName).getOrFail("MER Approver");
        const adminRole = _(userRolesByName).getOrFail("DM Admin");

        // TODO: MerReviewer should be able to create dashboard

        const dataReviewerRoleUpdated = {
            ...dataReviewerRole,
            authorities: _.union(dataReviewerRole.authorities, newAuthoritiesForReviewer),
        };

        const adminRoleUpdated = {
            ...adminRole,
            authorities: _.union(adminRole.authorities, newAuthoritiesForReviewer),
        };

        const merApproverRoleUpdated = {
            ...merApproverRole,
            authorities: _.union(merApproverRole.authorities, newAuthoritiesForMERApprover),
        };

        this.debug("Post updated dataReviewer/admin roles");
        const payload = {
            userRoles: [dataReviewerRoleUpdated, adminRoleUpdated, merApproverRoleUpdated],
        };
        await post(this.api, this.debug, payload);
    }
}

const migration: Migration = {
    name: "Migrate to DHIS 2.36",
    migrate: async (api: D2Api, debug: Debug) => new MigrationTo236(api, debug).execute(),
};

export default migration;

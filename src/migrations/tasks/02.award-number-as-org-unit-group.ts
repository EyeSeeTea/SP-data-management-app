import _ from "lodash";
import { D2Api, D2Payload, Id } from "../../types/d2-api";
import { Debug, Migration } from "../types";
import { getUid, getRefs } from "../../utils/dhis2";
import { post } from "./common";

class AwardNumberMigration {
    constructor(private api: D2Api, private debug: Debug) {}

    async execute() {
        await this.createOrgUnitGroupSet();
        await this.createAttributeForDashboard();
        await this.addOrgUnitGroupPermissionToRoles();
        await this.addExistingProjectsToOrgUnitGroupAwardNumber();
    }

    private async post<Payload extends D2Payload>(payload: Payload) {
        post(this.api, this.debug, payload);
    }

    async createOrgUnitGroupSet() {
        this.debug("Create org unit group set for award number");

        return this.post({
            organisationUnitGroupSets: [
                {
                    id: getId("organisationUnitGroupSets", "awardNumber"),
                    name: "Award number",
                    code: "AWARD_NUMBER",
                },
            ],
        });
    }

    async createAttributeForDashboard() {
        this.debug("Create attribute for award number dashboard ID");

        return this.post({
            attributes: [
                {
                    id: getId("attributes", "awardNumber-dashboard"),
                    name: "Award Number Dashboard ID",
                    code: "DM_AWARD_NUMBER_DASHBOARD_ID",
                    valueType: "TEXT",
                    organisationUnitGroupAttribute: true,
                    sortOrder: 4,
                    unique: true,
                },
            ],
        });
    }

    async addOrgUnitGroupPermissionToRoles() {
        this.debug("Add org unit group permission to edit roles");

        const { userRoles } = await this.api.metadata
            .get({
                userRoles: {
                    fields: { $owner: true, id: true, authorities: true },
                    filter: { authorities: { in: ["F_ORGUNITGROUP_PUBLIC_ADD"] } },
                },
            })
            .getData();

        const newUserRoles = userRoles.map(userRole => ({
            ...userRole,
            authorities: userRole.authorities.concat(["F_ORGUNITGROUPSET_PUBLIC_ADD"]),
        }));

        return this.post({ userRoles: newUserRoles });
    }

    async addExistingProjectsToOrgUnitGroupAwardNumber() {
        this.debug("Add existing projects to org unit group award number");

        const { organisationUnits, organisationUnitGroupSets } = await this.api.metadata
            .get({
                organisationUnits: {
                    fields: { id: true, code: true },
                    filter: { level: { eq: "3" } },
                },
                organisationUnitGroupSets: {
                    fields: { $owner: true },
                    filter: { code: { eq: "AWARD_NUMBER" } },
                },
            })
            .getData();

        const awardNumberGroupSet = _.first(organisationUnitGroupSets);
        if (!awardNumberGroupSet) throw new Error("Award number group set not found");

        const organisationUnitGroups = _(organisationUnits)
            .filter(ou => !_.isEmpty(ou.code) && ou.code.length >= 7)
            .groupBy(ou => ou.code.slice(0, 5))
            .toPairs()
            .map(([awardNumber, orgUnits]) => {
                return {
                    id: getUid("awardNumber", awardNumber),
                    name: `Award Number ${awardNumber}`,
                    organisationUnits: orgUnits.map(ou => ({ id: ou.id })),
                };
            })
            .value();

        const awardNumberGroupSetUpdated = {
            ...awardNumberGroupSet,
            organisationUnitGroups: getRefs(organisationUnitGroups),
        };

        return this.post({
            organisationUnitGroups,
            organisationUnitGroupSets: [awardNumberGroupSetUpdated],
        });
    }
}

function getId(model: string, key: string): Id {
    return getUid(model + "-", key);
}

const migration: Migration = {
    name: "Setup project awardNumber metadata",
    migrate: async (api: D2Api, debug: Debug) => new AwardNumberMigration(api, debug).execute(),
};

export default migration;

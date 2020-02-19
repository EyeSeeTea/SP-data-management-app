import { GetItemType } from "./../types/utils";
import _ from "lodash";
import { Config } from "./Config";

type UserConfig = Pick<Config, "base" | "currentUser">;
type OrganisationUnit = GetItemType<Config["currentUser"]["organisationUnits"]>;

export type Role = "admin" | "dataReviewer" | "dataViewer" | "dataEntry";

export type Action =
    | "create"
    | "accessMER"
    | "actualValues"
    | "targetValues"
    | "dashboard"
    | "downloadData"
    | "edit"
    | "dataApproval"
    | "delete";

const actionsByRole: Record<Role, Action[]> = {
    admin: [
        "create",
        "actualValues",
        "targetValues",
        "dashboard",
        "downloadData",
        "edit",
        "delete",
        "dataApproval",
        "accessMER",
    ],
    dataReviewer: [
        "create",
        "actualValues",
        "targetValues",
        "dashboard",
        "downloadData",
        "edit",
        "dataApproval",
        "accessMER",
    ],
    dataViewer: ["dashboard", "downloadData"],
    dataEntry: ["actualValues", "targetValues", "dashboard", "downloadData"],
};

export default class User {
    public roles: Set<Role>;
    public actions: Set<Action>;

    constructor(private config: UserConfig) {
        this.roles = buildRoles(config);
        this.actions = buildActions(this.roles);
    }

    hasRole(role: Role): boolean {
        return this.roles.has(role);
    }

    can(action: Action): boolean {
        return this.actions.has(action);
    }

    getOrgUnits(): OrganisationUnit[] {
        return this.config.currentUser.organisationUnits;
    }

    getCountries(): OrganisationUnit[] {
        const { orgUnitLevelForCountries } = this.config.base;
        return this.getOrgUnits().filter(ou => ou.level === orgUnitLevelForCountries);
    }
}

function buildRoles(config: UserConfig) {
    const { currentUser } = config;
    const allRoles = Object.keys(actionsByRole) as Role[];

    const userRoles = allRoles.filter(role => {
        const roleNames = config.base.userRoles[role];
        return _.intersection(currentUser.userRoles.map(ur => ur.name), roleNames).length > 0;
    });

    return new Set(userRoles);
}

function buildActions(roles: Set<Role>) {
    const actions = _(actionsByRole)
        .at(Array.from(roles))
        .flatten()
        .value();

    return new Set(actions);
}

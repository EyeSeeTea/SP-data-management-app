import { GetItemType } from "./../types/utils";
import _ from "lodash";
import { Config } from "./Config";

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
        "targetValues",
        "actualValues",
        "dashboard",
        "downloadData",
        "edit",
        "delete",
        "dataApproval",
        "accessMER",
    ],
    dataReviewer: [
        "create",
        "targetValues",
        "actualValues",
        "dashboard",
        "downloadData",
        "edit",
        "dataApproval",
        "accessMER",
    ],
    dataViewer: ["dashboard", "downloadData"],
    dataEntry: ["targetValues", "actualValues", "dashboard", "downloadData"],
};

type UserConfig = Pick<Config, "base" | "currentUser">;
type OrganisationUnit = GetItemType<Config["currentUser"]["organisationUnits"]>;

export default class User {
    public roles: Role[];
    public actions: Action[];

    constructor(private config: UserConfig) {
        this.roles = buildRoles(config);
        this.actions = buildActions(this.roles);
    }

    hasRole(role: Role): boolean {
        return this.roles.includes(role);
    }

    can(action: Action): boolean {
        return this.actions.includes(action);
    }

    getOrgUnits(): OrganisationUnit[] {
        return this.config.currentUser.organisationUnits;
    }

    getCountries(): OrganisationUnit[] {
        const { levelForCountries } = this.config.base.orgUnits;
        return this.getOrgUnits().filter(ou => ou.level === levelForCountries);
    }
}

function buildRoles(config: UserConfig) {
    const { currentUser } = config;
    const allRoles = Object.keys(actionsByRole) as Role[];

    return allRoles.filter(role => {
        const roleNames = config.base.userRoles[role];
        return _.intersection(currentUser.userRoles.map(ur => ur.name), roleNames).length > 0;
    });
}

function buildActions(roles: Role[]) {
    return _(actionsByRole)
        .at(roles)
        .flatten()
        .value();
}

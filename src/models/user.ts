import { GetItemType } from "./../types/utils";
import _ from "lodash";
import { Config } from "./Config";

export type Role = "admin" | "dataReviewer" | "dataViewer" | "dataEntry" | "merApprover";

export type Action =
    | "create"
    | "accessMER"
    | "actualValues"
    | "targetValues"
    | "dashboard"
    | "awardNumberDashboard"
    | "countryDashboard"
    | "downloadData"
    | "edit"
    | "dataApproval"
    | "reopen"
    | "delete";

const actionsByRole: Record<Role, Action[]> = {
    admin: [
        "create",
        "targetValues",
        "actualValues",
        "dashboard",
        "awardNumberDashboard",
        "countryDashboard",
        "downloadData",
        "edit",
        "delete",
        "dataApproval",
        "accessMER",
        "reopen",
    ],
    dataReviewer: [
        "create",
        "targetValues",
        "actualValues",
        "dashboard",
        "countryDashboard",
        "downloadData",
        "edit",
        "dataApproval",
        "accessMER",
        "reopen",
    ],
    dataViewer: ["dashboard", "awardNumberDashboard", "downloadData"],
    merApprover: [
        "dashboard",
        "countryDashboard",
        "awardNumberDashboard",
        "downloadData",
        "accessMER",
    ],
    dataEntry: [
        "targetValues",
        "actualValues",
        "dashboard",
        "awardNumberDashboard",
        "downloadData",
    ],
};

type UserConfig = Pick<Config, "base" | "currentUser">;
export type OrganisationUnit = GetItemType<Config["currentUser"]["organisationUnits"]>;

export default class User {
    data: Config["currentUser"];
    public roles: Role[];
    public actions: Action[];

    constructor(private config: UserConfig) {
        this.data = config.currentUser;
        this.roles = buildRoles(config);
        this.actions = buildActions(this.roles);
    }

    hasRole(role: Role): boolean {
        return this.roles.includes(role);
    }

    can(action: Action): boolean {
        return this.actions.includes(action);
    }

    cannot(action: Action): boolean {
        return !this.can(action);
    }

    getOrgUnits(): OrganisationUnit[] {
        return this.config.currentUser.organisationUnits;
    }

    getCountries(): OrganisationUnit[] {
        const { levelForCountries } = this.config.base.orgUnits;
        return _(this.getOrgUnits())
            .filter(ou => ou.level === levelForCountries)
            .sortBy(ou => ou.displayName)
            .value();
    }
}

function buildRoles(config: UserConfig) {
    const { currentUser } = config;
    const allRoles = Object.keys(actionsByRole) as Role[];

    return allRoles.filter(role => {
        const roleNames = config.base.userRoles[role];
        return (
            _.intersection(
                currentUser.userRoles.map(ur => ur.name),
                roleNames
            ).length > 0
        );
    });
}

function buildActions(roles: Role[]) {
    return _(actionsByRole)
        .at(roles)
        .flatten()
        .value();
}

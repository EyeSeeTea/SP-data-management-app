import _ from "lodash";
import { Config } from "./Config";

type UserConfig = Pick<Config, "base" | "currentUser">;

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

    getOrgUnits(): Config["currentUser"]["organisationUnits"] {
        return this.config.currentUser.organisationUnits;
    }

    can(action: Action): boolean {
        return this.actions.has(action);
    }
}

function buildRoles(config: UserConfig) {
    const { currentUser } = config;
    const allRoles = Object.keys(actionsByRole) as Role[];

    const userRoles = allRoles.filter(role => {
        const roleNames = config.base.userRoles[role];
        return (
            _(currentUser.userRoles.map(ur => ur.name))
                .intersection(roleNames)
                .size() > 0
        );
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

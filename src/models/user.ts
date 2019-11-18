import _ from "lodash";
import { Config } from "./config";

export default class User {
    constructor(private config: Config) {}

    canCreateProject(): boolean {
        return this.hasRole("reportingAnalyst");
    }

    hasRole(roleKey: keyof Config["userRoles"]): boolean {
        const { currentUser, userRoles } = this.config;
        return (
            _(currentUser.userRoles)
                .map(userRole => userRole.name)
                .intersection(userRoles[roleKey])
                .size() > 0
        );
    }

    getOrgUnits(): Config["currentUser"]["organisationUnits"] {
        return this.config.currentUser.organisationUnits;
    }
}

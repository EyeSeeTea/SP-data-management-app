import _ from "lodash";
import { Config } from "./Config";

export default class User {
    constructor(private config: Config) {}

    canCreateProject(): boolean {
        return this.hasRole("reportingAnalyst") || this.hasRole("superUser");
    }

    hasRole(roleKey: keyof Config["base"]["userRoles"]): boolean {
        const { currentUser } = this.config;
        const { userRoles } = this.config.base;
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

import _ from "lodash";
import { Config } from "./Config";

type UserConfig = Pick<Config, "base" | "currentUser">;

export default class User {
    constructor(private config: UserConfig) {}

    canCreateProject(): boolean {
        return this.hasRole("admin");
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

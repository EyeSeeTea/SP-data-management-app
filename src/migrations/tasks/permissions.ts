import _ from "lodash";
import { D2Api } from "../../types/d2-api";
import { Debug } from "../types";
import { Config } from "../../models/Config";

export function checkCurrentUserIsSuperadmin(config: Config): void {
    if (!config.currentUser.authorities.includes("ALL"))
        throw new Error("Only a user with authority ALL can run this migration");
}

export async function checkCurrentUserInAdminGroup(
    api: D2Api,
    config: Config,
    debug: Debug
): Promise<void> {
    const { objects: userGroups } = await api.models.userGroups
        .get({
            fields: { $owner: true },
            filter: { name: { eq: "System Admin" } },
        })
        .getData();

    const { currentUser } = config;
    const adminGroup = userGroups[0];
    if (!adminGroup) throw new Error(`Cannot find system admin group`);

    const userIds = adminGroup.users.map(user => user.id);
    if (!userIds.includes(currentUser.id)) {
        const newUserIds = _(adminGroup.users)
            .map(user => user.id)
            .union([currentUser.id])
            .value();
        debug(`Add current user ${currentUser.id} to group ${adminGroup.name}`);
        const newAdminGroup = { ...adminGroup, users: newUserIds.map(id => ({ id })) };
        const res = await api.models.userGroups.put(newAdminGroup).getData();
        if (res.status !== "OK") throw new Error("Cannot update admin group");
    } else {
        debug(`Current user ${currentUser.displayName} is already in group ${adminGroup.name}`);
    }
}

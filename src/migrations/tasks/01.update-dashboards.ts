import { Config } from "./../../models/Config";
import _ from "lodash";
import { D2Api, Id } from "../../types/d2-api";
import { Debug, Migration } from "../types";
import Project from "../../models/Project";
import { promiseMap, enumerate } from "../utils";
import { getConfig } from "../../models/Config";
import ProjectDashboardSave from "../../models/ProjectDashboardSave";
import ProjectsList from "../../models/ProjectsList";

async function migrate(api: D2Api, debug: Debug): Promise<void> {
    const config = await getConfig(api);

    checkCurrentUserIsSuperadmin(config);
    await checkCurrentUserInAdminGroup(api, config, debug);

    const projectIds = await getProjectIds(api, config, debug);
    debug(`Projects count: ${projectIds.length}`);

    await saveProjectDashboards(api, config, debug, projectIds);
}

async function saveProjectDashboards(api: D2Api, config: Config, debug: Debug, projectIds: Id[]) {
    return promiseMap(enumerate(projectIds), async ([idx, projectId]) => {
        const project = await Project.get(api, config, projectId);
        const name = `[${project.parentOrgUnit?.displayName}] ${project.name} (${project.id})`;
        debug(`Save dashboard for project (${idx + 1} / ${projectIds.length}): ${name}`);
        await new ProjectDashboardSave(project).execute();
    });
}

function checkCurrentUserIsSuperadmin(config: Config) {
    if (!config.currentUser.authorities.includes("ALL"))
        throw new Error("Only a user with authority ALL can run this migration");
}

async function checkCurrentUserInAdminGroup(api: D2Api, config: Config, debug: Debug) {
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
        debug(`Current user (${currentUser.displayName} is already in group ${adminGroup.name}`);
    }
}

async function getProjectIds(api: D2Api, config: Config, debug: Debug): Promise<Id[]> {
    debug("Get projects");

    const { objects: projectItems } = await new ProjectsList(api, config).get(
        {},
        { field: "id", order: "asc" },
        { page: 1, pageSize: 100000 }
    );

    return _(projectItems)
        .orderBy([project => project.parent.displayName, project => project.displayName])
        .map(project => project.id)
        .value();
}

const migration: Migration = { name: "Update Dashboards", migrate };

export default migration;

import { Config } from "./../../models/Config";
import { D2Api, Id } from "../../types/d2-api";
import { Debug, Migration } from "../types";
import Project from "../../models/Project";
import { promiseMap, enumerate } from "../utils";
import { getConfig } from "../../models/Config";
import { checkCurrentUserIsSuperadmin, checkCurrentUserInAdminGroup } from "./permissions";
import { getProjectIds } from "./common";

async function updateProjectsAwardNumber(api: D2Api, debug: Debug): Promise<void> {
    const config = await getConfig(api);

    checkCurrentUserIsSuperadmin(config);
    await checkCurrentUserInAdminGroup(api, config, debug);

    const projectIds = await getProjectIds(api, config, debug);
    debug(`Projects count: ${projectIds.length}`);

    await updateProjectsAwardNumberFromIds(api, config, debug, projectIds);
}

async function updateProjectsAwardNumberFromIds(
    api: D2Api,
    config: Config,
    debug: Debug,
    projectIds: Id[]
) {
    return promiseMap(enumerate(projectIds), async ([idx, projectId]) => {
        const project = await Project.get(api, config, projectId);
        const name = `[${project.parentOrgUnit?.displayName}] ${project.name} (${project.id})`;
        debug(`Save project (${idx + 1}/${projectIds.length}): ${name}`);
        await project.save();
    });
}

const migration: Migration = {
    name: "Update project award number",
    migrate: updateProjectsAwardNumber,
};

export default migration;

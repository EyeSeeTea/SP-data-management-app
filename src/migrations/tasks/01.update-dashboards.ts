import { Config } from "./../../models/Config";
import { D2Api, Id } from "../../types/d2-api";
import { Debug, Migration } from "../types";
import Project from "../../models/Project";
import { promiseMap, enumerate } from "../utils";
import { getConfig } from "../../models/Config";
import ProjectDashboardSave from "../../models/ProjectDashboardSave";
import { getProjectIds } from "./common";

async function migrate(api: D2Api, debug: Debug): Promise<void> {
    const config = await getConfig(api);
    const projectIds = await getProjectIds(api, config, debug);
    debug(`Projects count: ${projectIds.length}`);
    await saveProjectDashboards(api, config, debug, projectIds);
}

async function saveProjectDashboards(api: D2Api, config: Config, debug: Debug, projectIds: Id[]) {
    return promiseMap(enumerate(projectIds), async ([idx, projectId]) => {
        const project = await Project.get(api, config, projectId);
        const name = `[${project.parentOrgUnit?.displayName}] ${project.name} (${project.id})`;
        debug(`Save dashboard (${idx + 1} / ${projectIds.length}): ${name}`);
        await new ProjectDashboardSave(project).execute();
    });
}

const migration: Migration = { name: "Update Dashboards", migrate };

export default migration;

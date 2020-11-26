import { MigrationTasks, migration } from "../types";
import updateDashboardsMigration from "./01.update-dashboards";
import updateProjectsAwardNumber from "./02.award-number-as-org-unit-group";

export const migrationTasks: MigrationTasks = [
    migration(1, updateDashboardsMigration),
    migration(2, updateProjectsAwardNumber),
];

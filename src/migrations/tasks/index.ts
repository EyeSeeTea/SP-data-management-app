import { MigrationWithVersion } from "../types";
import updateDashboardsMigration from "./01.update-dashboards";

export const migrationTasks: MigrationWithVersion[] = [
    { version: 1, ...updateDashboardsMigration },
];

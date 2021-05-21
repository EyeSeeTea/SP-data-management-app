import { MigrationTasks, migration } from "../types";

export async function getMigrationTasks(): Promise<MigrationTasks> {
    return [
        migration(1, (await import("./01.update-dashboards")).default),
        migration(2, (await import("./02.award-number-as-org-unit-group")).default),
        migration(3, (await import("./03.add-role-mer-approver")).default),
        migration(4, (await import("./04.set-livelihoods-code")).default),
        migration(5, (await import("./05.extend-covid-disaggregation")).default),
    ];
}

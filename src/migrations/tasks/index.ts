import { MigrationTasks, migration } from "../types";

export async function getMigrationTasks(): Promise<MigrationTasks> {
    return [
        migration(1, (await import("./01.update-dashboards")).default),
        migration(2, (await import("./02.award-number-as-org-unit-group")).default),
        migration(3, (await import("./03.add-role-mer-approver")).default),
        migration(4, (await import("./04.set-livelihoods-code")).default),
        migration(5, (await import("./05.extend-covid-disaggregation")).default),
        migration(6, (await import("./06.add-benefits-disaggregation")).default),
        migration(7, (await import("./07.update-to-v2.36")).default),
        migration(8, (await import("./08.set-integer-people-dataelements")).default),
        migration(9, (await import("./09.add-last-updated-data")).default),
    ];
}

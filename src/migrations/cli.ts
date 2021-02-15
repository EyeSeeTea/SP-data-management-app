import { D2Api } from "../types/d2-api";
import { MigrationsRunner } from "./index";
import { getMigrationTasks } from "./tasks";

async function main() {
    const [baseUrl, auth] = process.argv.slice(2);
    if (!baseUrl) throw new Error("Usage: index.ts DHIS2_URL [AUTH]");

    const url = auth ? baseUrl.replace("://", `://${auth}@`) : baseUrl;
    const api = new D2Api({ baseUrl: url });
    const runner = await MigrationsRunner.init({
        api,
        debug: console.debug,
        migrations: await getMigrationTasks(),
        dataStoreNamespace: "data-management-app",
    });
    runner.execute();
}

main();

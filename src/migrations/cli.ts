import axiosRetry from "axios-retry";
import { D2Api } from "../types/d2-api";
import { MigrationsRunner } from "./index";
import { migrationTasks } from "./tasks";

async function main() {
    const [baseUrl] = process.argv.slice(2);
    if (!baseUrl) throw new Error("Usage: index.ts DHIS2_URL");
    const api = new D2Api({ baseUrl: baseUrl });
    axiosRetry(api.connection, { retries: 3 });
    const runner = await MigrationsRunner.init({
        api,
        debug: console.debug,
        migrations: migrationTasks,
        dataStoreNamespace: "data-management-app",
    });
    runner.execute();
}

main();

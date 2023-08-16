import parse from "parse-typed-args";
import { Config, getConfig } from "../models/Config";
import { GlobalValidatorReport } from "../models/validators/GlobalValidator";
import { D2Api } from "../types/d2-api";

/*
    https://app.clickup.com/t/865cqypkn

    Send a report with validations problems:

        $ yarn ts-node src/scripts/send-validations-report.ts --url "http://USER:PASSWORD@URL"
*/

class SendValidationsReport {
    constructor(private api: D2Api) {}

    static async main() {
        const parser = parse({ opts: { url: {}, parentOrgUnitId: {} } });
        const { opts } = parser(process.argv);

        const api = new D2Api({ baseUrl: opts.url, backend: "xhr" });
        new this(api).execute(opts);
    }

    async execute(options: { parentOrgUnitId?: string }) {
        const config = await this.getConfig();
        const report = new GlobalValidatorReport(this.api, config);
        await report.execute(options);
    }

    /* Private */

    private async getConfig(): Promise<Config> {
        this.log("Get config");
        return getConfig(this.api);
    }

    private log(s: string) {
        console.debug(s);
    }
}

SendValidationsReport.main();

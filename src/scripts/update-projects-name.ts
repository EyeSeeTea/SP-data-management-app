import _ from "lodash";
import parse from "parse-typed-args";
import { Config, getConfig } from "../models/Config";
import { addAwardNumberPrefixForOrgUnit } from "../models/Project";
import { D2Api, MetadataPick } from "../types/d2-api";

/*
    https://app.clickup.com/t/865cqdjue

    Prefix orgUnit.name with the award number (orgUnit.code). Usage:

        $ yarn ts-node src/scripts/update-projects-name.ts --url "http://USER:PASSWORD@URL"
*/

class UpdateProjectName {
    constructor(private api: D2Api) {}

    static async main() {
        const parser = parse({ opts: { url: {} } });
        const { opts } = parser(process.argv);

        const api = new D2Api({ baseUrl: opts.url, backend: "xhr" });
        new this(api).execute();
    }

    async execute() {
        const config = await this.getConfig();
        const projectOrgUnits = await this.getProjectOrgUnits(config);
        const orgUnitsFixed = this.addPrefixNameToOrgUnits(projectOrgUnits);
        this.postOrgUnits(orgUnitsFixed);
    }

    /* Private */

    private async getConfig(): Promise<Config> {
        this.log("Get config");
        return getConfig(this.api);
    }

    private async getProjectOrgUnits(config: Config) {
        const { api, log } = this;
        log("Get organisation units");

        const { organisationUnits: orgUnits } = await api.metadata
            .get({ organisationUnits: { fields: { $owner: true } } })
            .getData();

        log(`Organisation units: ${orgUnits.length}`);

        const projectOrgUnits = orgUnits.filter(orgUnit =>
            orgUnit.attributeValues.some(
                av => av.attribute.id === config.attributes.createdByApp.id && av.value === "true"
            )
        );

        log(`Project Organisation units: ${orgUnits.length}`);

        return projectOrgUnits;
    }

    private addPrefixNameToOrgUnits(projectOrgUnits: D2OrgUnit[]): D2OrgUnit[] {
        const { log } = this;

        return _(projectOrgUnits)
            .map((orgUnit): typeof orgUnit | undefined => {
                const newName = addAwardNumberPrefixForOrgUnit(orgUnit).trim();
                const newOrgUnit = { ...orgUnit, name: newName, shortName: newName.slice(0, 50) };
                if (!_.isEqual(orgUnit, newOrgUnit)) {
                    log(`Fix org unit name [id=${orgUnit.id}]: "${orgUnit.name}" -> "${newName}"`);
                    return newOrgUnit;
                } else {
                    return undefined;
                }
            })
            .compact()
            .tap(orgUnitsFixed => {
                log(`Project Organisation units with names to fix: ${orgUnitsFixed.length}:`);
            })
            .value();
    }

    private async postOrgUnits(orgUnitsFixed: D2OrgUnit[]) {
        const { log } = this;
        const res = await this.api.metadata
            .post({ organisationUnits: orgUnitsFixed }, { importMode: "COMMIT" })
            .getData();

        if (res.status === "OK") {
            log(`Success: ${JSON.stringify(res.stats)}`);
        } else {
            log(`Error: ${JSON.stringify(res, null, 4)}`);
            process.exit(1);
        }
    }

    private log(s: string) {
        console.debug(s);
    }
}

type D2OrgUnit = MetadataPick<{
    organisationUnits: { fields: { $owner: true } };
}>["organisationUnits"][number];

UpdateProjectName.main();

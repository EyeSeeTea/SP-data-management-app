import _ from "lodash";
import parse from "parse-typed-args";
import { promiseMap } from "../migrations/utils";
import { Config } from "../models/Config";
import ProjectDb, { ProjectJson } from "../models/ProjectDb";
import { D2Api } from "../types/d2-api";
import { getApp, readJson, writeJson } from "./common";

async function main() {
    const parser = parse({
        opts: { url: {}, from: {} },
    });
    const { opts, args } = parser(process.argv);

    const usage = `projects
            --url=DHIS2_URL
            [--from=CREATED_FROM_TIMESTAMP]
            import projects.json OR export projects.json
        `;
    const app = opts.url ? await getApp({ baseUrl: opts.url }) : null;
    const command = args[0];

    if (!app || !command) {
        console.error(usage);
    } else if (command === "export" && args[1]) {
        const jsonPath = args[1];
        exportProjects(app, { jsonPath, from: opts.from });
    } else if (command === "import" && args[1]) {
        const jsonPath = args[1];
        importProjects(app, { jsonPath });
    } else {
        console.error(`Unknown command: ${command}`);
        console.error(usage);
    }
}

async function exportProjects(
    app: { api: D2Api; config: Config },
    options: { jsonPath: string; from?: string }
) {
    const { api, config } = app;
    const { jsonPath, from } = options;

    const orgUnits$ = api.metadata.get({
        organisationUnits: {
            fields: {
                id: true,
                name: true,
                attributeValues: { attribute: { id: true }, value: true },
            },
            filter: from ? { created: { ge: from } } : {},
        },
    });

    const orgUnits = _(await orgUnits$.getData())
        .thru(res => res.organisationUnits)
        .filter(orgUnit =>
            _.some(
                orgUnit.attributeValues,
                av => av.attribute.id === config.attributes.createdByApp.id && av.value === "true"
            )
        )
        .value();

    console.debug(`OrgUnits: ${orgUnits.length}`);

    const jsonCollection = await promiseMap(orgUnits, async orgUnit => {
        console.debug(`Get project: ${orgUnit.name} (${orgUnit.id})`);
        const project = await ProjectDb.get(api, config, orgUnit.id);
        const projectDb = new ProjectDb(project);
        const json = await projectDb.toJSON();
        return json;
    });

    await writeJson(jsonPath, jsonCollection);
}

async function importProjects(app: { api: D2Api; config: Config }, options: { jsonPath: string }) {
    const { api, config } = app;
    const { jsonPath } = options;
    const jsonCollection = readJson<ProjectJson[]>(jsonPath);

    const orgUnits$ = api.metadata.get({ organisationUnits: { fields: { id: true } } });
    const { organisationUnits: existingOrgUnits } = await orgUnits$.getData();

    const allOrgUnitIds = new Set(
        _(jsonCollection)
            .flatMap(json => json.metadata.organisationUnits.map(ou => ou.id))
            .concat(existingOrgUnits.map(ou => ou.id))
            .compact()
            .value()
    );

    for (const json of jsonCollection) {
        console.debug(`Import: ${json.name} (${json.id})`);
        await ProjectDb.fromJSON(api, config, json, allOrgUnitIds);
    }
}

main().catch(err => {
    console.error("ERROR", err, err.response);
    process.exit(1);
});

import fs from "fs";
import path from "path";
import _ from "lodash";
import { Config, getConfig } from "../models/Config";
import { D2Api, DataValueSetsDataValue, DataValueSetsPostParams, Id } from "../types/d2-api";

export interface App {
    config: Config;
    api: D2Api;
}

export const categoryCombosMapping: Record<string, string> = {
    default: "COVID-19",
    "New-Returning/Gender": "COVID-19/New-Returning/Gender",
};

function getDataFilePath(filename: string): string {
    return path.join(__dirname, "data", filename + ".json");
}

export function readDataFilePath<T>(filename: string): T {
    const filePath = getDataFilePath(filename);
    console.error(`Read: ${filePath}`);
    const json = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(json);
}

export function writeDataFilePath(filename: string, obj: object): void {
    const filePath = getDataFilePath(filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    writeJson(filePath, obj);
}

export function writeJson(jsonPath: string, obj: object): void {
    const json = JSON.stringify(obj, null, 4);
    fs.writeFileSync(jsonPath, json);
    console.error(`Written: ${jsonPath}`);
}

export function readJson<T>(jsonPath: string): T {
    console.error(`Read: ${jsonPath}`);
    const json = fs.readFileSync(jsonPath, "utf8");
    return JSON.parse(json);
}

export function assert<T>(obj: T | null | undefined | false, msg?: string): asserts obj {
    const hasValue = obj !== undefined && obj != null && obj !== false;
    if (!hasValue) throw new Error("Assert error" + (msg ? `: ${msg}` : ""));
}

const cacheEnable = false;

export async function getApp(options: { baseUrl: string }): Promise<App> {
    const { baseUrl } = options;
    const configCachePath = getDataFilePath("config.json");
    const api = new D2Api({ baseUrl });

    if (cacheEnable && fs.existsSync(configCachePath)) {
        console.error(`From cache file: ${configCachePath}`);
        const contents = fs.readFileSync(configCachePath, "utf8");
        const config = JSON.parse(contents) as Config;
        return { api, config };
    } else {
        const config = await getConfig(api);
        const json = JSON.stringify(config, null, 2);
        fs.mkdirSync(path.dirname(configCachePath), { recursive: true });
        fs.writeFileSync(configCachePath, json);
        console.error(`Written: ${configCachePath}`);
        return { api, config };
    }
}

export async function postDataValues(
    api: D2Api,
    filePath: string,
    importStrategy: DataValueSetsPostParams["importStrategy"]
) {
    const metadata = readDataFilePath(filePath) as { dataValues: DataValueSetsDataValue[] };
    const res = await api.dataValues.postSet({ importStrategy, force: true }, metadata).getData();
    console.error(res);
    assert(res.status === "SUCCESS", `Post data values error: ${JSON.stringify(res)}`);
}

export async function getCocsMapping(app: App) {
    const { api } = app;

    const { categoryCombos } = await api.metadata
        .get({
            categoryCombos: {
                fields: {
                    id: true,
                    name: true,
                    categoryOptionCombos: { id: true, name: true },
                },
            },
        })
        .getData();

    const categoryCombosByName = _.keyBy(categoryCombos, cc => cc.name);

    const cocsMapping = _(categoryCombosMapping)
        .toPairs()
        .flatMap(([nonCovidCcName, covidCcName]) => {
            const nonCovidCc = _(categoryCombosByName).getOrFail(nonCovidCcName);
            const covidCc = _(categoryCombosByName).getOrFail(covidCcName);
            const covidCocs = _.keyBy(covidCc.categoryOptionCombos, coc => coc.name);
            return nonCovidCc.categoryOptionCombos.map(nonCovidCoc => {
                const covidName =
                    "COVID-19" + (nonCovidCoc.name !== "default" ? `, ${nonCovidCoc.name}` : "");
                const covidCoc = covidCocs[covidName];
                assert(covidCoc, `Covid COC not found: ${covidName}`);
                return [nonCovidCoc.id, covidCoc.id] as [Id, Id];
            });
        })
        .fromPairs()
        .value();

    return cocsMapping;
}

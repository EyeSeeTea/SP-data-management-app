import fs from "fs";
import _ from "lodash";
import { IndicatorType, PeopleOrBenefit } from "../models/dataElementsSet";
import { Config, getConfig } from "../models/Config";
import { D2Api } from "../types/d2-api";

export interface DataElement {
    code: Code;
    name: string;
    description: string;
    $type: IndicatorType;
    $series: string;
    $peopleBenefit: PeopleOrBenefit;
    $sectors: Sectors;
    $externals: Externals;
    $mainSector: string;
    $pairedDataElement?: Code;
    $oldCode?: string;
    $countingMethod?: string;
}

interface Data {
    dataElements: DataElement[];
    toDelete: [];
}

type Code = string;
type Sectors = Record<string, { series: string }>;
type Externals = Record<string, string>;

async function main(baseUrl: string) {
    const api = new D2Api({ baseUrl });
    const config = await getConfig(api);
    const dataElements = getMetadataDataElements(config);
    const data: Data = { dataElements, toDelete: [] };
    const json = JSON.stringify(data, null, 4);

    const outputPath = "data-elements-from-instance.json";
    fs.writeFileSync(outputPath, json);
    console.log(`Written: ${outputPath}`);
}

function getMetadataDataElements(config: Config): DataElement[] {
    const sectorById = _.keyBy(config.sectors, sector => sector.id);

    return _(config.dataElements)
        .sortBy(de => de.code)
        .map(de => {
            const externalsString = _(de.externals)
                .toPairs()
                .map(([name, external]) => name + (external.name ? `: ${external.name}` : ""))
                .join(" | ");

            const description = ["Externals: ", externalsString || "-", "\n", de.description]
                .join("")
                .trim();

            const sectors = _(de.sectorsInfo)
                .map(si => [_(sectorById).getOrFail(si.id).displayName, { series: si.series }])
                .fromPairs()
                .value();

            const pairedCode = de.pairedDataElements.map(pde => pde.code)[0];

            const dataElement: DataElement = {
                code: de.code,
                name: de.name,
                description,
                $type: de.indicatorType,
                $series: de.mainSeries || "No series",
                $peopleBenefit: de.peopleOrBenefit,
                $sectors: sectors,
                $externals: _.mapValues(de.externals, ext => ext.name || ""),
                $mainSector: de.mainSector.name,
                ...(pairedCode ? { $pairedDataElement: pairedCode } : {}),
                ...(de.countingMethod ? { $countingMethod: de.countingMethod } : {}),
            };

            return dataElement;
        })
        .value();
}

const [baseUrl] = process.argv.slice(2);

main(baseUrl);

/*
    Abstract list of Project data element of type DataElement. Usage:

    const dataElementsSet = await DataElements.build(api)
    const dataElements = dataElementsSet.get();
    # [... Array of data elements ...]
*/

import { DataElement } from "./data-elements-set";
import { D2Api, Ref } from "d2-api";
import _ from "lodash";
import "../utils/lodash-mixins";

export interface DataElement {
    id: string;
    name: string;
    code: string;
    sectorId: string;
    indicatorType: "global" | "sub";
    peopleOrBenefit: "people" | "benefit";
    series: string;
    pairedDataElement: string;
}

const config = {
    dataElementGroupSetSectorCode: "SECTOR",
    attributes: {
        pairedDataElementCode: "PM_PAIRED_DE",
    },
    dataElementGroupCodes: {
        global: "GLOBAL",
        sub: "SUB",
        people: "PEOPLE",
        benefit: "BENEFIT",
    },
};

type GroupCode = typeof config.dataElementGroupCodes;

interface DataElementsData {
    dataElements: DataElement[];
    selected: string[];
}

export default class DataElements {
    constructor(private data: DataElementsData) {}

    get selected(): string[] {
        return this.data.selected;
    }

    static async build(api: D2Api) {
        const { attributes, dataElementGroupSets, dataElementGroups } = await api.metadata
            .get(metadataFields)
            .getData();

        const sectorsCode = config.dataElementGroupSetSectorCode;
        const sectorsSet = _(dataElementGroupSets)
            .keyBy("code")
            .get(sectorsCode, undefined);
        const attributePairedElements = _(attributes)
            .keyBy("code")
            .get(config.attributes.pairedDataElementCode, undefined);
        const degCodes = config.dataElementGroupCodes;

        const sectorGroups = sectorsSet ? sectorsSet.dataElementGroups : [];

        const dataElements = _.flatMap(sectorGroups, sectorGroup => {
            const groupCodeByDataElementId = getGroupCodeByDataElementId(dataElementGroups);
            const sectorCode = sectorGroup.code.replace(/^SECTOR_/, "");

            return _(sectorGroup.dataElements)
                .map(d2DataElement => {
                    const pairedDataElement = _(d2DataElement.attributeValues)
                        .map(attributeValue =>
                            attributePairedElements &&
                            attributeValue.attribute.id == attributePairedElements.id
                                ? attributeValue.value
                                : null
                        )
                        .compact()
                        .first();
                    const groupCodes = groupCodeByDataElementId[d2DataElement.id];
                    if (!groupCodes) return;

                    const indicatorType = groupCodes.has(degCodes.global)
                        ? "global"
                        : groupCodes.has(degCodes.sub)
                        ? "sub"
                        : undefined;

                    const peopleOrBenefit = groupCodes.has(degCodes.people)
                        ? "people"
                        : groupCodes.has(degCodes.benefit)
                        ? "benefit"
                        : undefined;

                    const seriesPrefix = `SERIES_${sectorCode}_`;

                    const seriesCode = Array.from(groupCodes).find(code =>
                        code.startsWith(seriesPrefix)
                    );

                    if (!indicatorType) {
                        console.error(`Data Element ${d2DataElement.id} has no indicator type 1`);
                    } else if (!peopleOrBenefit) {
                        console.error(`Data Element ${d2DataElement.id} has no indicator type 2`);
                    } else if (!seriesCode) {
                        console.error(`Data Element ${d2DataElement.id} has no series`);
                    } else {
                        const dataElement: DataElement = {
                            id: d2DataElement.id,
                            name: d2DataElement.displayName,
                            code: d2DataElement.code,
                            sectorId: sectorGroup.id,
                            indicatorType,
                            peopleOrBenefit,
                            series: seriesCode.replace(seriesPrefix, ""),
                            pairedDataElement: pairedDataElement || "",
                        };
                        return dataElement;
                    }
                })
                .compact()
                .value();
        });

        return new DataElements({ dataElements, selected: [] });
    }

    get(options: { sectorId?: string }): DataElement[] {
        const { dataElements: items } = this.data;
        return options.sectorId ? items.filter(de => de.sectorId === options.sectorId) : items;
    }

    updateSelection(dataElementIds: string[]): DataElements {
        return new DataElements({ ...this.data, selected: dataElementIds });
    }
}

const yes = true as const;

const metadataFields = {
    attributes: {
        fields: { id: yes, code: yes },
        filter: { code: { eq: config.attributes.pairedDataElementCode } },
    },
    dataElementGroupSets: {
        fields: {
            code: yes,
            dataElementGroups: {
                id: yes,
                displayName: yes,
                code: yes,
                dataElements: {
                    id: yes,
                    code: yes,
                    attributeValues: { attribute: { id: yes }, value: yes },
                    displayName: yes,
                },
            },
        },
        filter: {
            code: { eq: config.dataElementGroupSetSectorCode },
        },
    },
    dataElementGroups: {
        fields: {
            code: yes,
            dataElements: { id: yes },
        },
        filter: {},
    },
};

type DataElementGroup = { code: string; dataElements: Ref[] };

function getGroupCodeByDataElementId<K extends keyof GroupCode>(
    dataElementGroups: DataElementGroup[]
): { [dataElementId: string]: Set<string> } {
    const getGroupCodeByDataElementId = _(dataElementGroups)
        .flatMap(dataElementGroup =>
            dataElementGroup.dataElements.map(de => ({ id: de.id, code: dataElementGroup.code }))
        )
        .groupBy("id")
        .mapValues(group => new Set(group.map(o => o.code)))
        .value();

    return getGroupCodeByDataElementId;
}

import { Sector } from "./Project";
import { DataElement } from "./dataElementsSet";
import { D2Api, Ref, Id } from "d2-api";
import _ from "lodash";
import i18n from "../locales";

/*
    Abstract list of Project data element of type DataElement. Usage:

    const dataElementsSet = await DataElements.build(api)
    const dataElements = dataElementsSet.get();
    # [... Array of data elements ...]
*/

type GetItemType<T> = T extends (infer U)[] ? U : never;

export const indicatorTypes = ["global" as const, "sub" as const];

export type IndicatorType = GetItemType<typeof indicatorTypes>;

export interface DataElement {
    id: Id;
    name: string;
    code: string;
    sectorId: Id;
    indicatorType: IndicatorType;
    peopleOrBenefit: "people" | "benefit";
    series: string;
    pairedDataElementCode: string;
    categoryComboId: Id;
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

export interface SelectionUpdate {
    selected: DataElement[];
    unselected: DataElement[];
}

type Filter = Partial<{
    sectorId: string;
    series: string;
    indicatorType: string;
    onlySelected: boolean;
}>;

function getSectorAndSeriesKey(
    dataElement: DataElement,
    dataElementOverride: Partial<DataElement> = {}
): string {
    const de = _.merge({}, dataElement, dataElementOverride);
    return [de.sectorId, de.series, de.indicatorType].join("-");
}

export default class DataElements {
    dataElementsBy: {
        id: Record<Id, DataElement>;
        code: Record<string, DataElement>;
        sectorAndSeries: Record<string, DataElement[]>;
    };

    constructor(private data: DataElementsData) {
        this.dataElementsBy = {
            id: _.keyBy(data.dataElements, de => de.id),
            code: _.keyBy(data.dataElements, de => de.code),
            sectorAndSeries: _.groupBy(data.dataElements, de => getSectorAndSeriesKey(de)),
        };
    }

    validate(sectors: Sector[]) {
        const sectorsWithSelectedItems = _(this.getSelected())
            .countBy(de => de.sectorId)
            .keys()
            .map(sectorId => ({ id: sectorId }))
            .value();
        const missingSectors = _(sectors)
            .differenceBy(sectorsWithSelectedItems, sector => sector.id)
            .map(s => s.displayName)
            .value();

        return missingSectors.length > 0
            ? [i18n.t(`Those sectors have no indicators selected: ${missingSectors.join(", ")}`)]
            : [];
    }

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
                            pairedDataElementCode: pairedDataElement || "",
                            categoryComboId: d2DataElement.categoryCombo.id,
                        };
                        return dataElement;
                    }
                })
                .compact()
                .value();
        });

        return new DataElements({ dataElements, selected: [] });
    }

    get(filter: Filter = {}): DataElement[] {
        if (_.isEqual(filter, {})) return this.data.dataElements;

        const { sectorId, series, indicatorType, onlySelected } = filter;
        const { dataElements: items } = this.data;
        const selected = new Set(onlySelected ? this.data.selected : []);

        return items.filter(
            de =>
                (!sectorId || de.sectorId === sectorId) &&
                (!series || de.series === series) &&
                (!indicatorType || de.indicatorType === indicatorType) &&
                (!onlySelected || selected.has(de.id))
        );
    }

    getSelected(filter: Filter = {}): DataElement[] {
        return this.get({ ...filter, onlySelected: true });
    }

    updateSelection(
        dataElementIds: string[]
    ): { related: SelectionUpdate; dataElements: DataElements } {
        const { selected } = this.data;
        const newSelected = _.difference(dataElementIds, selected);
        // const newUnselected = _.difference(selected, dataElementIds);
        const currentSelection = new Set(dataElementIds);
        const related = {
            selected: this.getRelated(newSelected).filter(de => !currentSelection.has(de.id)),
            unselected: [] as DataElement[], // this.getRelated(newUnselected).filter(de => currentSelection.has(de.id)),
        };
        const finalSelected = _(dataElementIds)
            .union(related.selected.map(de => de.id))
            .difference(related.unselected.map(de => de.id))
            .value();
        const dataElementsUpdated = new DataElements({ ...this.data, selected: finalSelected });

        return { related, dataElements: dataElementsUpdated };
    }

    getRelated(dataElementIds: Id[]) {
        const dataElements = dataElementIds.map(
            dataElementId => _(this.dataElementsBy.id).get(dataElementId) as DataElement
        );

        const relatedBySeries = _(dataElements)
            .map(dataElement => {
                const related =
                    dataElement.indicatorType == "sub"
                        ? _(this.dataElementsBy.sectorAndSeries).get(
                              getSectorAndSeriesKey(dataElement, { indicatorType: "global" }),
                              []
                          )
                        : [];
                return { id: dataElement.id, related };
            })
            .value();

        const relatedByPairing = _(dataElements)
            .map(dataElement => {
                const pairedDataElement = dataElement.pairedDataElementCode
                    ? _(this.dataElementsBy.code).get(dataElement.pairedDataElementCode, null)
                    : null;
                return { id: dataElement.id, related: _.compact([pairedDataElement]) };
            })
            .value();

        return _(relatedBySeries)
            .concat(relatedByPairing)
            .groupBy(({ id }) => id)
            .mapValues(groups => _.flatMap(groups, ({ related }) => related))
            .values()
            .flatten()
            .value();
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
                    categoryCombo: { id: yes },
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

function getGroupCodeByDataElementId(
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

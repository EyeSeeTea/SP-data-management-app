import _ from "lodash";
import { Id } from "d2-api";

import { Config, DataElementGroupSet, BaseConfig, Metadata } from "./Config";
import { Sector } from "./Project";
import i18n from "../locales";
import { GetItemType } from "../types/utils";

/*
    Abstract list of Project data element of type DataElement. Usage:

    const dataElementsSet = await DataElements.build(api)
    const dataElements = dataElementsSet.get();
    # [... Array of data elements ...]
*/

export const indicatorTypes = ["global" as const, "sub" as const];
export const peopleOrBenefit = ["people" as const, "benefit" as const];

export type IndicatorType = GetItemType<typeof indicatorTypes>;
export type PeopleOrBenefit = GetItemType<typeof peopleOrBenefit>;

export interface DataElementWithCodePairing {
    id: Id;
    name: string;
    code: string;
    description: string;
    sectorId: Id;
    indicatorType: IndicatorType;
    peopleOrBenefit: PeopleOrBenefit;
    countingMethod: string;
    series: string;
    pairedDataElementCode: string;
    categoryComboId: Id;
}

export interface DataElement extends DataElementWithCodePairing {
    pairedDataElement: DataElement | undefined;
    pairedDataElementName: string | undefined; // Add separate field so we can filter in objects table
}

interface DataElementsData {
    dataElements: DataElement[];
    selected: string[];
    selectedMER: string[];
}

export interface SelectionUpdate {
    selected: DataElement[];
    unselected: DataElement[];
}

type GetOptions = Partial<{
    sectorId: string;
    series: string;
    indicatorType: IndicatorType;
    peopleOrBenefit: PeopleOrBenefit;
    onlySelected: boolean;
    onlyMERSelected: boolean;
    includePaired: boolean;
}>;

type DataElementGroupCodes = Config["base"]["dataElementGroups"];

function getSectorAndSeriesKey(
    dataElement: DataElement,
    dataElementOverride: Partial<DataElement> = {}
): string {
    const de = _.merge({}, dataElement, dataElementOverride);
    return [de.sectorId, de.series, de.indicatorType].join("-");
}

export default class DataElementsSet {
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

    validateSelection(sectors: Sector[]) {
        const sectorsWithSel = this.get({ onlySelected: true }).map(de => ({ id: de.sectorId }));
        const missingSectors = _(sectors)
            .differenceBy(sectorsWithSel, sector => sector.id)
            .map(sector => sector.displayName)
            .value();
        const msg = i18n.t(
            "The following sectors have no indicators selected:" + " " + missingSectors.join(", ")
        );

        return _.isEmpty(missingSectors) ? [] : [msg];
    }

    validateMER(_sectors: Sector[]) {
        const selectedMER = this.get({ onlyMERSelected: true });
        return _.isEmpty(selectedMER) ? [i18n.t("Select at least one indicator")] : [];
    }

    get selected(): string[] {
        return this.data.selected;
    }

    static async getDataElements(
        baseConfig: BaseConfig,
        metadata: Metadata
    ): Promise<DataElement[]> {
        const { dataElementGroupSets } = metadata;
        const sectorsCode = baseConfig.dataElementGroupSets.sector;
        const sectorsSet = getBy(dataElementGroupSets, "code", sectorsCode);
        const degCodes = baseConfig.dataElementGroups;
        const dataElementsById = _(metadata.dataElements).keyBy(de => de.id);

        return _.flatMap(sectorsSet.dataElementGroups, sectorGroup => {
            const groupCodesByDataElementId = getGroupCodeByDataElementId(dataElementGroupSets);

            const dataElements = sectorGroup.dataElements.map(dataElementRef => {
                const d2DataElement = dataElementsById.getOrFail(dataElementRef.id);
                const attrsMap = getAttrsMap(baseConfig.attributes, d2DataElement.attributeValues);
                const { pairedDataElement, countingMethod } = attrsMap;
                const groupCodes = groupCodesByDataElementId[d2DataElement.id] || new Set();
                const indicatorType = getGroupKey(groupCodes, degCodes, ["global", "sub"]);
                const peopleOrBenefit = getGroupKey(groupCodes, degCodes, ["people", "benefit"]);
                const seriesPrefix = `SERIES_`;
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
                    const dataElement: DataElementWithCodePairing = {
                        id: d2DataElement.id,
                        name: d2DataElement.displayName,
                        code: d2DataElement.code,
                        description: d2DataElement.description,
                        sectorId: sectorGroup.id,
                        indicatorType,
                        peopleOrBenefit,
                        series: seriesCode.replace(seriesPrefix, ""),
                        pairedDataElementCode: pairedDataElement || "",
                        countingMethod: countingMethod || "",
                        categoryComboId: d2DataElement.categoryCombo.id,
                    };
                    return dataElement;
                }
            });

            return getMainDataElements(_.compact(dataElements));
        });
    }

    static build(config: Config) {
        return new DataElementsSet({
            dataElements: config.dataElements,
            selected: [],
            selectedMER: [],
        });
    }

    get(options: GetOptions = {}): DataElement[] {
        if (_.isEqual(options, {})) return this.data.dataElements;

        const {
            sectorId,
            series,
            indicatorType,
            onlySelected,
            onlyMERSelected,
            peopleOrBenefit,
        } = options;
        const { dataElements } = this.data;
        const selected = onlySelected ? new Set(this.data.selected) : new Set();
        const selectedMER = onlyMERSelected ? new Set(this.data.selectedMER) : new Set();
        const includePaired = onlyMERSelected ? true : options.includePaired;

        const mainDEs = onlySelected
            ? dataElements.filter(dataElement => selected.has(dataElement.id))
            : dataElements;

        const dataElementsIncluded = includePaired
            ? _.uniqBy(_.flatMap(mainDEs, de => _.compact([de, de.pairedDataElement])), "id")
            : mainDEs;

        const dataElementsFiltered = dataElementsIncluded.filter(
            dataElement =>
                (!sectorId || dataElement.sectorId === sectorId) &&
                (!series || dataElement.series === series) &&
                (!indicatorType || dataElement.indicatorType === indicatorType) &&
                (!peopleOrBenefit || dataElement.peopleOrBenefit === peopleOrBenefit) &&
                (!onlyMERSelected || selectedMER.has(dataElement.id))
        );

        return dataElementsFiltered;
    }

    updateSelection(
        dataElementIds: string[]
    ): { related: SelectionUpdate; dataElements: DataElementsSet } {
        const { selected } = this.data;
        const newSelected = _.difference(dataElementIds, selected);
        // const newUnselected = _.difference(selected, dataElementIds);
        const currentSelection = new Set(dataElementIds);
        const related = {
            selected: this.getRelated(newSelected).filter(de => !currentSelection.has(de.id)),
            unselected: [] as DataElement[],
        };
        const finalSelected = _(dataElementIds)
            .union(related.selected.map(de => de.id))
            .difference(related.unselected.map(de => de.id))
            .value();
        const dataElementsUpdated = new DataElementsSet({
            ...this.data,
            selected: finalSelected,
        });

        return { related, dataElements: dataElementsUpdated };
    }

    get selectedMER() {
        return this.data.selectedMER;
    }

    updateMERSelection(dataElementIds: string[]): DataElementsSet {
        const selectedIds = this.get({ onlySelected: true, includePaired: true }).map(de => de.id);
        return new DataElementsSet({
            ...this.data,
            selectedMER: _.intersection(selectedIds, dataElementIds),
        });
    }

    getFullSelection(dataElementIds: string[], sectorId: string, getOptions: GetOptions): string[] {
        const selectedIdsInOtherSectors = this.get(getOptions)
            .filter(de => de.sectorId !== sectorId)
            .map(de => de.id);
        return _.union(selectedIdsInOtherSectors, dataElementIds);
    }

    getRelated(dataElementIds: Id[]): DataElement[] {
        const dataElements = _(dataElementIds)
            .map(dataElementId => _(this.dataElementsBy.id).get(dataElementId) as DataElement)
            .compact()
            .value();

        const relatedGlobalBySeries = _(dataElements)
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

        return _(relatedGlobalBySeries)
            .groupBy(({ id }) => id)
            .mapValues(groups => _.flatMap(groups, ({ related }) => related))
            .values()
            .flatten()
            .value();
    }
}

function getMainDataElements(dataElements: DataElementWithCodePairing[]): DataElement[] {
    const pairedCodes = new Set(
        _(dataElements)
            .filter(de => de.peopleOrBenefit === "benefit")
            .map(de => de.pairedDataElementCode)
            .uniq()
            .value()
    );
    const dataElementsByCode = _(dataElements).keyBy(de => de.code);
    const nonPairedPeopleDataElements = _.reject(
        dataElements,
        de => de.peopleOrBenefit === "people" && pairedCodes.has(de.code)
    );

    return nonPairedPeopleDataElements.map(dataElement => {
        const de = dataElementsByCode.get(dataElement.pairedDataElementCode, undefined);
        const pairedDataElement = de
            ? { ...de, pairedDataElement: undefined, pairedDataElementName: undefined }
            : undefined;
        return {
            ...dataElement,
            pairedDataElement,
            pairedDataElementName: de ? de.name : undefined,
        };
    });
}

function getGroupCodeByDataElementId(
    dataElementGroupSets: DataElementGroupSet[]
): { [dataElementId: string]: Set<string> } {
    return _(dataElementGroupSets)
        .flatMap(degSet => degSet.dataElementGroups)
        .flatMap(deg => deg.dataElements.map(de => ({ id: de.id, code: deg.code })))
        .groupBy(obj => obj.id)
        .mapValues(objs => new Set(objs.map(obj => obj.code)))
        .value();
}

function getGroupKey<T extends keyof DataElementGroupCodes>(
    groupCodes: Set<string>,
    degCodes: DataElementGroupCodes,
    keys: (T)[]
): T | undefined {
    return keys.find(key => groupCodes.has(degCodes[key]));
}

function getBy<T, K extends keyof T>(objs: T[], key: K, value: T[K]): T {
    const matchingObj = objs.find(obj => obj[key] === value);
    if (!matchingObj) {
        throw new Error(`Cannot get object: ${key}=${value}`);
    } else {
        return matchingObj;
    }
}

type AttributeValue = { attribute: { code: string }; value: string };

function getAttrsMap(
    attributes: BaseConfig["attributes"],
    attributeValues: AttributeValue[]
): Record<keyof BaseConfig["attributes"], string | null> {
    const valuesByAttributeCode = fromPairs(
        attributeValues.map(attributeValue => [attributeValue.attribute.code, attributeValue.value])
    );

    return fromPairs(
        getKeys(attributes).map(key => {
            const code = attributes[key];
            const value = _(valuesByAttributeCode).get(code, null);
            return [key, value];
        })
    );
}

/* Type-safe helpers */

function fromPairs<Key extends string, Value>(pairs: Array<[Key, Value]>): Record<Key, Value> {
    const empty = {} as Record<Key, Value>;
    return pairs.reduce((acc, [key, value]) => ({ ...acc, [key]: value }), empty);
}

function getKeys<T, K extends keyof T>(obj: T): K[] {
    return Object.keys(obj) as K[];
}

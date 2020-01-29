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

export const indicatorTypes = ["global", "sub", "custom"] as const;
export const peopleOrBenefitList = ["people", "benefit"] as const;

export type IndicatorType = typeof indicatorTypes[number];
export type PeopleOrBenefit = typeof peopleOrBenefitList[number];

export interface DataElementWithCodePairing {
    id: Id;
    name: string;
    code: string;
    description: string;
    sectorId: Id;
    isMainSector: boolean;
    indicatorType: IndicatorType;
    peopleOrBenefit: PeopleOrBenefit;
    countingMethod: string;
    externals: string[]; // an empty string means internals
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
    selected: string[]; // TODO: {dataElementId: Id, sectorId: Id}
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
    externals: string[];
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
        const {
            sector: sectorsCode,
            externals: externalsCode,
            series: seriesCode,
        } = baseConfig.dataElementGroupSets;
        const sectorsSet = getBy(dataElementGroupSets, "code", sectorsCode);
        const seriesSet = getBy(dataElementGroupSets, "code", seriesCode);
        const externalsSet = getBy(dataElementGroupSets, "code", externalsCode);
        const externalsByDataElementId = _(externalsSet.dataElementGroups)
            .flatMap(deg => deg.dataElements.map(de => ({ deId: de.id, name: deg.displayName })))
            .groupBy(data => data.deId)
            .mapValues(dataList => _.sortBy(dataList.map(data => data.name)))
            .value();
        const degCodes = baseConfig.dataElementGroups;
        const dataElementsById = _(metadata.dataElements).keyBy(de => de.id);

        return _.flatMap(sectorsSet.dataElementGroups, sectorGroup => {
            const groupCodesByDataElementId = getGroupCodeByDataElementId(dataElementGroupSets);
            const seriesGroupsForSector = seriesSet.dataElementGroups.filter(deg => {
                // series Code = SERIES_PROTECTION_1002
                const [_seriesLiteral, sectorCode, series] = deg.code.split("_");
                return sectorGroup.code.split("_")[1] === sectorCode ? series : null;
            });
            const dataElements = sectorGroup.dataElements.map(dataElementRef => {
                const deId = dataElementRef.id;
                const seriesGroups = seriesGroupsForSector.filter(seriesGroup =>
                    seriesGroup.dataElements.map(de => de.id).includes(deId)
                );

                const d2DataElement = dataElementsById.getOrFail(dataElementRef.id);
                const attrsMap = getAttrsMap(baseConfig.attributes, d2DataElement.attributeValues);
                const { pairedDataElement, countingMethod } = attrsMap;
                const groupCodes = groupCodesByDataElementId[d2DataElement.id] || new Set();
                const indicatorType = getGroupKey(groupCodes, degCodes, indicatorTypes);
                const peopleOrBenefit = getGroupKey(groupCodes, degCodes, peopleOrBenefitList);
                const externals = _(externalsByDataElementId).get(d2DataElement.id, []);
                const deKey = `${d2DataElement.code}:${sectorGroup.code}`;

                if (!indicatorType) {
                    console.error(`DataElement ${deKey} has no indicator type 1`);
                } else if (!peopleOrBenefit) {
                    console.error(`DataElement ${deKey} has no indicator type 2`);
                } else if (seriesGroups.length > 1) {
                    console.error(
                        `DataElement ${deKey} has ${seriesGroups.length} series, using first`
                    );
                } else {
                    const dataElement: DataElementWithCodePairing = {
                        id: d2DataElement.id,
                        name: d2DataElement.displayName,
                        code: d2DataElement.code,
                        description: d2DataElement.description,
                        sectorId: sectorGroup.id,
                        isMainSector: attrsMap.mainSector === sectorGroup.code,
                        indicatorType,
                        peopleOrBenefit,
                        series: seriesGroups.length > 0 ? seriesGroups[0].code : "",
                        pairedDataElementCode: pairedDataElement || "",
                        countingMethod: countingMethod || "",
                        externals,
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
            externals,
        } = options;
        const { dataElements } = this.data;
        const selected = onlySelected ? new Set(this.data.selected) : new Set();
        const selectedMER = onlyMERSelected ? new Set(this.data.selectedMER) : new Set();
        const includePaired = onlyMERSelected ? true : options.includePaired;

        const mainDEs = onlySelected
            ? dataElements.filter(dataElement => selected.has(dataElement.id))
            : dataElements;

        const dataElementsIncluded = includePaired
            ? _.uniqBy(_.flatMap(mainDEs, de => _.compact([de, de.pairedDataElement])), de =>
                  [de.id, de.sectorId].join("-")
              )
            : mainDEs;

        const dataElementsFiltered = dataElementsIncluded.filter(
            dataElement =>
                (!sectorId || dataElement.sectorId === sectorId) &&
                (!series || dataElement.series === series) &&
                (!indicatorType || dataElement.indicatorType === indicatorType) &&
                (!peopleOrBenefit || dataElement.peopleOrBenefit === peopleOrBenefit) &&
                (!onlyMERSelected || selectedMER.has(dataElement.id)) &&
                (!externals ||
                    _.isEmpty(externals) ||
                    _.intersection(dataElement.externals, externals).length > 0 ||
                    (_.includes(externals, "") && _.isEmpty(dataElement.externals)))
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
        const allDataElements = this.get(getOptions);
        const previousIdsInSector = allDataElements
            .filter(de => de.sectorId === sectorId)
            .map(de => de.id);
        const unselectedIds = new Set(_.difference(previousIdsInSector, dataElementIds));

        const selectedIdsInOtherSectors = allDataElements
            .filter(de => de.sectorId !== sectorId && !unselectedIds.has(de.id))
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
    keys: readonly T[]
): T | undefined {
    return keys.find(key => groupCodes.has(degCodes[key]));
}

function getBy<T, K extends keyof T>(objs: T[], key: K, value: T[K]): T {
    const matchingObj = objs.find(obj => obj[key] === value);
    if (!matchingObj) {
        throw new Error(
            `Cannot get object: ${key}=${value} (${objs.map(obj => obj[key]).join(", ")})`
        );
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

function getKeys<T>(obj: T): Array<keyof T> {
    return Object.keys(obj) as Array<keyof T>;
}

function accumulate<Key extends string, Value>(pairs: Array<[Key, Value]>): Record<Key, Value[]> {
    const output = {} as Record<Key, Value[]>;
    pairs.forEach(([key, value]) => {
        if (!output[key]) {
            output[key] = [value];
        } else {
            output[key].push(value);
        }
    });

    return output;
}

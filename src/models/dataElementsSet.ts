import _ from "lodash";
import { Id, Ref } from "d2-api";

import { Config, DataElementGroupSet, BaseConfig, Metadata, CurrentUser } from "./Config";
import { Sector } from "./Project";
import i18n from "../locales";
import User from "./user";

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

type SectorInfo = { id: Id; series?: string };

export interface DataElementBase {
    id: Id;
    name: string;
    code: string;
    description: string;
    sectorsInfo: SectorInfo[];
    mainSector: Ref;
    indicatorType: IndicatorType;
    peopleOrBenefit: PeopleOrBenefit;
    countingMethod: string;
    externals: string[];
    pairedDataElements: Array<{ id: Id; name: string; code: string }>;
    categoryCombo: Ref;
    selectable: boolean;
}

// Add separate field so we can filter in objects table: TOIMP
export interface DataElement extends Omit<DataElementBase, "sectors" | "mainSector"> {
    base: DataElementBase;
    sector: Ref;
    isMainSector: boolean;
    series?: string;
    pairedDataElements: DataElement[];
}

type SectorId = Id;
type BySector<T> = Record<SectorId, T>;

interface DataElementsData {
    dataElementsBase: DataElementBase[];
    dataElementsAllBySector: BySector<DataElement[]>;
    dataElementsBySector: BySector<DataElement[]>;
    selected: BySector<Id[]>;
}

export interface SelectionInfo {
    selected?: DataElement[];
    messages?: string[];
}

type GetOptions = Partial<{
    sectorId: string;
    series: string;
    indicatorType: IndicatorType;
    peopleOrBenefit: PeopleOrBenefit;
    includePaired: boolean;
    onlySelected: boolean;
    externals: string[];
}>;

type DataElementGroupCodes = Config["base"]["dataElementGroups"];

export default class DataElementsSet {
    constructor(private config: Config, public data: DataElementsData) {}

    validateAtLeastOneItemPerSector(sectors: Sector[]) {
        const sectorsWithSel = this.get({ onlySelected: true }).map(de => ({ id: de.sector.id }));
        const missingSectors = _(sectors)
            .differenceBy(sectorsWithSel, sector => sector.id)
            .map(sector => sector.displayName)
            .value();
        const msg = i18n.t(
            "The following sectors have no indicators selected:" + " " + missingSectors.join(", ")
        );

        return _.isEmpty(missingSectors) ? [] : [msg];
    }

    validatetOneItemTotal() {
        const selected = this.get({ onlySelected: true });
        return _.isEmpty(selected) ? [i18n.t("Select at least one indicator")] : [];
    }

    static async getDataElements(
        currentUser: CurrentUser,
        baseConfig: BaseConfig,
        metadata: Metadata
    ): Promise<DataElementBase[]> {
        const { dataElementGroupSets } = metadata;
        const degsCodes = baseConfig.dataElementGroupSets;
        const sectorsSet = getBy(dataElementGroupSets, "code", degsCodes.sector);
        const seriesSet = getBy(dataElementGroupSets, "code", degsCodes.series);
        const externalsSet = getBy(dataElementGroupSets, "code", degsCodes.externals);
        const externalsByDataElementId = _(externalsSet.dataElementGroups)
            .flatMap(deg => deg.dataElements.map(de => ({ deId: de.id, name: deg.displayName })))
            .groupBy(data => data.deId)
            .mapValues(dataList => _.sortBy(dataList.map(data => data.name)))
            .value();
        const degCodes = baseConfig.dataElementGroups;
        const dataElementsById = _.keyBy(metadata.dataElements, de => de.id);
        const dataElementsByCode = _.keyBy(metadata.dataElements, de => de.code);
        const userIsAdmin = new User({ base: baseConfig, currentUser }).hasRole("admin");
        const sectorsByCode = _.keyBy(sectorsSet.dataElementGroups, deg => deg.code);

        const d2DataElements = _(sectorsSet.dataElementGroups)
            .flatMap(deg => deg.dataElements.map(deRef => dataElementsById[deRef.id]))
            .compact()
            .uniqBy(de => de.id)
            .value();

        const sectorsByDataElementId = _(sectorsSet.dataElementGroups)
            .flatMap(deg => deg.dataElements.map(deRef => ({ deId: deRef.id, deg })))
            .groupBy(item => item.deId)
            .mapValues(items => items.map(item => item.deg))
            .value();

        // TOIMPL: DRY
        const seriesByDataElementId = _(seriesSet.dataElementGroups)
            .flatMap(deg => deg.dataElements.map(deRef => ({ deId: deRef.id, deg })))
            .groupBy(item => item.deId)
            .mapValues(items => items.map(item => item.deg))
            .value();

        const groupCodesByDataElementId = getGroupCodeByDataElementId(dataElementGroupSets);

        const dataElements = d2DataElements.map(d2DataElement => {
            const deId = d2DataElement.id;
            const sectorsGroups = _(sectorsByDataElementId).get(deId) || [];
            const seriesGroups = _(seriesByDataElementId).get(deId, undefined);
            const sectors: SectorInfo[] = sectorsGroups.map(sectorGroup => {
                const seriesGroupForSector = seriesGroups
                    ? seriesGroups.find(seriesGroup => {
                          // series.code = SERIES_${sectorCode}_${number}. Example: SERIES_FOOD_5002
                          const [, sectorCode, series] = seriesGroup.code.split("_");
                          return sectorGroup.code.split("_")[1] === sectorCode ? series : null;
                      })
                    : undefined;
                return {
                    id: sectorGroup.id,
                    series: seriesGroupForSector
                        ? _.last(seriesGroupForSector.code.split("_"))
                        : undefined,
                };
            });

            const attrsMap = getAttrsMap(baseConfig.attributes, d2DataElement.attributeValues);
            const { mainSector, countingMethod } = attrsMap;
            const groupCodes = groupCodesByDataElementId[deId] || new Set();
            const indicatorType = getGroupKey(groupCodes, degCodes, indicatorTypes);
            const peopleOrBenefit = getGroupKey(groupCodes, degCodes, peopleOrBenefitList);
            const externals = _(externalsByDataElementId).get(d2DataElement.id, []);
            const deCode = d2DataElement.code;
            const isSelectable = indicatorType !== "custom" || userIsAdmin;
            const name =
                d2DataElement.displayName +
                (isSelectable ? "" : ` ${i18n.t("[only for admin users]")}`);
            const pairedDataElements = getPairedDataElements(
                attrsMap.pairedDataElement,
                dataElementsByCode
            );

            if (!indicatorType) {
                console.error(`DataElement ${deCode} has no indicator type`);
                return null;
            } else if (!peopleOrBenefit) {
                console.error(`DataElement ${deCode} has no indicator type people/benefit`);
                return null;
            } else if (!mainSector) {
                console.error(`DataElement ${deCode} has no main sector`);
                return null;
            } else {
                const dataElement: DataElementBase = {
                    id: d2DataElement.id,
                    name: name,
                    code: d2DataElement.code,
                    description: d2DataElement.description,
                    sectorsInfo: sectors,
                    mainSector: { id: _(sectorsByCode).getOrFail(mainSector).id },
                    indicatorType,
                    peopleOrBenefit,
                    pairedDataElements,
                    countingMethod: countingMethod || "",
                    externals,
                    categoryCombo: { id: d2DataElement.categoryCombo.id },
                    selectable: isSelectable,
                };
                return dataElement;
            }
        });

        return _.compact(dataElements);
    }

    static build(config: Config, options: { superSet?: DataElementsSet; groupPaired: boolean }) {
        const { superSet, groupPaired } = options;
        const dataElementsBase = config.dataElements;
        const dataElementsAllBySector = getDataElementsBySector(config, { groupPaired });
        const desBySector = getDataElementsBySectorInSet(dataElementsAllBySector, superSet);

        return new DataElementsSet(config, {
            dataElementsBase,
            dataElementsAllBySector,
            dataElementsBySector: desBySector,
            selected: {},
        });
    }

    updateSuperSet(superSet: DataElementsSet): DataElementsSet {
        return new DataElementsSet(this.config, {
            ...this.data,
            dataElementsBySector: getDataElementsBySectorInSet(
                this.data.dataElementsAllBySector,
                superSet
            ),
        });
    }

    get(options: GetOptions = {}): DataElement[] {
        const { sectorId, series, onlySelected, includePaired } = options;
        const { indicatorType, peopleOrBenefit, externals } = options;
        const dataElementsBySector = this.data.dataElementsBySector;
        const sectorsIds = sectorId ? [sectorId] : _.keys(dataElementsBySector);

        return _.flatMap(sectorsIds, sectorId => {
            const dataElements1 = _(dataElementsBySector).get(sectorId, [] as DataElement[]);
            if (_.isEqual(options, {})) return dataElements1;

            const selectedIds = new Set(this.data.selected[sectorId] || []);

            const dataElements2 = onlySelected
                ? dataElements1.filter(de => selectedIds.has(de.id))
                : dataElements1;

            const dataElements3 = includePaired
                ? _(dataElements2)
                      .flatMap(de => [de, ...de.pairedDataElements])
                      .uniqBy(de => de.id)
                      .value()
                : dataElements2;

            return dataElements3.filter(
                dataElement =>
                    (!series || dataElement.series === series) &&
                    (!indicatorType || dataElement.indicatorType === indicatorType) &&
                    (!peopleOrBenefit || dataElement.peopleOrBenefit === peopleOrBenefit) &&
                    (!externals ||
                        _.isEmpty(externals) ||
                        _.intersection(dataElement.externals, externals).length > 0 ||
                        (_.includes(externals, "") && _.isEmpty(dataElement.externals)))
            );
        });
    }

    updateSelected(dataElementsBySectorId: Record<Id, Id[]>): DataElementsSet {
        return new DataElementsSet(this.config, {
            ...this.data,
            selected: { ...this.data.selected, ...dataElementsBySectorId },
        });
    }

    updateSelectedWithRelations(
        sectorId: Id,
        dataElementIds: string[]
    ): { selectionInfo: SelectionInfo; dataElements: DataElementsSet } {
        const newSelection = new Set(dataElementIds);
        const prevSelection = new Set(this.get({ sectorId, onlySelected: true }).map(de => de.id));
        const newRelated = this.getRelated(sectorId, dataElementIds);
        const unselectable = newRelated.filter(
            de => prevSelection.has(de.id) && !newSelection.has(de.id)
        );
        const msg = i18n.t("Global data elements with selected subs cannot be unselected");
        const selectionInfo = {
            selected: newRelated.filter(de => !prevSelection.has(de.id)),
            messages: _.isEmpty(unselectable) ? undefined : [msg],
        };
        const finalSelected = _(dataElementIds)
            .union(selectionInfo.selected.map(de => de.id))
            .union(unselectable.map(de => de.id))
            .value();
        const dataElementsUpdated = this.updateSelected({ [sectorId]: finalSelected });

        return { selectionInfo, dataElements: dataElementsUpdated };
    }

    getRelated(sectorId: Id, dataElementIds: Id[]): DataElement[] {
        const { dataElementsAllBySector } = this.data;

        const allDataElements = dataElementsAllBySector[sectorId] || [];
        const allDataElementsByKey = _.keyBy(allDataElements, de =>
            [de.indicatorType, de.series].join(".")
        );
        const selectedDataElements = _(allDataElements)
            .keyBy(de => de.id)
            .at(dataElementIds)
            .compact()
            .value();

        const relatedDataElements = _.compact(
            selectedDataElements.map(de => {
                if (de.indicatorType === "sub") {
                    const key = ["global", de.series].join(".");
                    return _(allDataElementsByKey).get(key, null);
                } else {
                    return null;
                }
            })
        );

        return _.uniqBy(relatedDataElements, de => de.id);
    }
}

function getPairedDataElements(
    pairedDataElement: string | null,
    dataElementsByCode: Record<string, { id: Id; code: string; displayName: string }>
): Array<{ id: Id; code: string; name: string }> {
    return _((pairedDataElement || "").split(","))
        .map(s => s.trim())
        .compact()
        .map(code => {
            const de = _(dataElementsByCode).get(code, null);
            return de ? { id: de.id, code: de.code, name: de.displayName } : null;
        })
        .compact()
        .value();
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

function getDataElementsBySector(
    config: Config,
    options: { groupPaired: boolean }
): BySector<DataElement[]> {
    const { dataElements } = config;
    const { groupPaired } = options;

    const nonMainDataElementIds = groupPaired
        ? _.flatMap(dataElements, de => de.pairedDataElements)
        : [];

    const dataElementsWithoutPaired = _.flatMap(dataElements, dataElement =>
        dataElement.sectorsInfo.map(sectorInfo => ({
            ...dataElement,
            sector: { id: sectorInfo.id },
            base: dataElement,
            isMainSector: sectorInfo.id === dataElement.mainSector.id,
            series: sectorInfo.series,
        }))
    );

    const dataElementsById = _.keyBy(dataElementsWithoutPaired, de => de.id);

    const mainDataElements = _.differenceBy(
        dataElementsWithoutPaired,
        nonMainDataElementIds,
        de => de.id
    );

    const dataElementsWithPaired = mainDataElements.map(dataElement => {
        const pairedDataElementsInSameSector: DataElement[] = !groupPaired
            ? []
            : _.compact(
                  _(dataElement.pairedDataElements)
                      .map(de => {
                          const pairedDe = dataElementsById[de.id];
                          return pairedDe && pairedDe.sector.id === dataElement.sector.id
                              ? { ..._(dataElementsById).getOrFail(de.id), pairedDataElements: [] }
                              : null;
                      })
                      .compact()
                      .value()
              );
        return { ...dataElement, pairedDataElements: pairedDataElementsInSameSector };
    });

    return _.groupBy(dataElementsWithPaired, de => de.sector.id);
}

function getDataElementsBySectorInSet(
    dataElementsAllBySector: BySector<DataElement[]>,
    superSet: DataElementsSet | undefined
) {
    return superSet
        ? _(dataElementsAllBySector)
              .mapValues((dataElementsInSector, sectorId) =>
                  _.intersectionBy(
                      dataElementsInSector,
                      superSet.get({ sectorId, onlySelected: true, includePaired: true }),
                      de => de.id
                  )
              )
              .value()
        : dataElementsAllBySector;
}

/* Type-safe helpers */

function fromPairs<Key extends string, Value>(pairs: Array<[Key, Value]>): Record<Key, Value> {
    const empty = {} as Record<Key, Value>;
    return pairs.reduce((acc, [key, value]) => ({ ...acc, [key]: value }), empty);
}

function getKeys<T>(obj: T): Array<keyof T> {
    return Object.keys(obj) as Array<keyof T>;
}

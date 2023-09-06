import { D2Api, DataValueSetsDataValue, DataValueSetsGetRequest } from "../../types/d2-api";
import _ from "lodash";

import { DataSet, DataSetType, ProjectBasic } from "../Project";
import i18n from "../../locales";
import {
    DataValue,
    getReasonId,
    toFloat,
    ValidationItem,
    ValidationResult,
} from "./validator-common";
import { Maybe } from "../../types/utils";
import { Config } from "../Config";
import { getId } from "../../utils/dhis2";
import { DataElementBase, getDataElementName, getGlobal, getSubs } from "../dataElementsSet";
import { DataEntry } from "../DataEntry";

/*
    Validate:

    - A cell for a global value cannot be empty.
    - A global must be at least the value of its maximum sub-indicator (check both directions).
*/

type IndexedDataValues = Record<DataValueId, Maybe<DataValue>>;

type DataValueId = string;

export interface BasicData {
    config: Config;
    dataValues: IndexedDataValues;
    globalDataElements: GlobalDataElement[];
    period: string;
    orgUnitId: Id;
    attributeOptionComboId: Id;
}

interface ProjectData extends BasicData {
    project: ProjectBasic;
    dataSetType: DataSetType;
}

interface GlobalDataElement {
    id: Id;
    name: string;
    categoryOptionComboIds: Id[];
    subs: DataElementBase[];
    dataElement: DataElementBase;
}

export class GlobalValidator {
    constructor(private data: ProjectData) {}

    static async build(
        api: D2Api,
        project: ProjectBasic,
        dataSetType: DataSetType,
        period: string
    ): Promise<GlobalValidator> {
        if (!project.orgUnit || !project.dataSets)
            throw new Error("Cannot build validator: missing data");

        const { config } = project;
        const categoryOption = config.categoryOptions[dataSetType];
        const aocId = categoryOption.categoryOptionCombos.map(coc => coc.id)[0];
        const orgUnitId = project.orgUnit.id;
        const getSetOptions: DataValueSetsGetRequest = {
            orgUnit: [orgUnitId],
            dataSet: [project.dataSets.target.id],
            period: [period],
            attributeOptionCombo: [aocId],
        };

        const res = await api.dataValues.getSet(getSetOptions).getData();
        const dataValues = res.dataValues.map(dv => ({
            ...dv,
            dataElementId: dv.dataElement,
            categoryOptionComboId: dv.categoryOptionCombo,
        }));

        const indexedDataValues: ProjectData["dataValues"] = getIndexedDataValues(
            getDataValuesFromD2(dataValues)
        );
        const dataSet = project.dataSets[dataSetType];
        const globalDataElements = this.getGlobalDataElements(config, dataSet);

        return new GlobalValidator({
            project: project,
            config,
            dataSetType: dataSetType,
            globalDataElements,
            dataValues: indexedDataValues,
            period,
            orgUnitId: orgUnitId,
            attributeOptionComboId: aocId,
        });
    }

    static getGlobalDataElements(config: Config, dataSet: DataSet): GlobalDataElement[] {
        const dataElementsById = _.keyBy(config.dataElements, de => de.id);

        const projectDataElements = _(dataSet.dataSetElements)
            .map(dse => dataElementsById[dse.dataElement.id])
            .compact()
            .value();

        const globalDataElements: GlobalDataElement[] = _(dataSet.dataSetElements)
            .map((dse): GlobalDataElement | null => {
                const dataElement = dataElementsById[dse.dataElement.id];
                if (!dataElement || dataElement.indicatorType !== "global") return null;
                const categoryOptionComboIds = dse.categoryCombo.categoryOptionCombos.map(getId);
                const allSubDataElements = getSubs(config, dataElement.id);
                const subs = _.intersectionBy(projectDataElements, allSubDataElements, de => de.id);
                const name = getDataElementName(dataElement);

                return {
                    id: dataElement.id,
                    name,
                    categoryOptionComboIds,
                    subs,
                    dataElement: dataElement,
                };
            })
            .compact()
            .value();

        return globalDataElements;
    }

    onSave(dataValue: DataValue): GlobalValidator {
        const dataValuesUpdated = _.merge(
            {},
            this.data.dataValues,
            getIndexedDataValues([dataValue])
        );
        const newData = { ...this.data, dataValues: dataValuesUpdated };
        return new GlobalValidator(newData);
    }

    async validate(): Promise<ValidationItem[]> {
        return _.concat(
            this.validateNonEmptyGlobalsWhenSubsHaveValues(),
            this.validateAllGlobalsAreEqualOrGreaterThanMaxSub(),
            await this.validateThatGlobalsAreLessThanSumOfSubsForNewAndReturning()
        );
    }

    validateOnSave(dataValue: DataValue): ValidationItem[] {
        return _.concat(
            this.validateGlobalIsEqualOrGreaterThanMaxSub(dataValue),
            this.validateSubIsLessOrEqualThanGlobal(dataValue)
        );
    }

    async validateThatGlobalsAreLessThanSumOfSubsForNewAndReturning(): Promise<ValidationItem[]> {
        const { period, project, dataSetType } = this.data;
        const items = new GlobalSubsValidator(this.data).execute();
        const dataEntry = new DataEntry(project.api, project, dataSetType, period);
        const reasons = await dataEntry.getReasons(items);
        const upToDateReasonIds = _(reasons)
            .toPairs()
            .map(([reasonId, reason]) => (reason.upToDate ? reasonId : null))
            .compact()
            .value();

        return items.filter(item => !item.reason || !upToDateReasonIds.includes(item.reason.id));
    }

    validateAllGlobalsAreEqualOrGreaterThanMaxSub(): ValidationItem[] {
        return _(this.data.globalDataElements)
            .flatMap(globalDataElement => {
                return _.flatMap(globalDataElement.categoryOptionComboIds, cocId => {
                    const dataValue = this.getDataValue(globalDataElement.id, cocId);
                    return dataValue
                        ? this.validateGlobalIsEqualOrGreaterThanMaxSub(dataValue)
                        : [];
                });
            })
            .value();
    }

    private validateSubIsLessOrEqualThanGlobal(dataValue: DataValue): ValidationItem[] {
        const { value: strValue, categoryOptionComboId: cocId } = dataValue;
        if (!strValue) return [];

        const globalDataElement = getGlobal(this.data.config, dataValue.dataElementId);
        if (!globalDataElement) return [];

        const subValue = toFloat(strValue);
        const globalValue = this.getValue(globalDataElement.id, cocId);

        if (globalValue !== undefined && subValue > globalValue) {
            const msg = i18n.t(
                "A sub-indicator should be equal to or less than its global indicator: {{-name}} ({{value}})",
                {
                    name: getDataElementName(globalDataElement),
                    value: globalValue,
                    nsSeparator: false,
                }
            );
            return [{ level: "error", message: msg }];
        } else {
            return [];
        }
    }

    private validateGlobalIsEqualOrGreaterThanMaxSub(dataValue: DataValue): ValidationItem[] {
        const { value: strValue, categoryOptionComboId: cocId } = dataValue;
        if (!strValue) return [];

        const subDataElements = getSubs(this.data.config, dataValue.dataElementId);
        const globalValue = toFloat(strValue);

        const maxSubItem = _(subDataElements)
            .map(subDataElement => {
                const value = this.getValue(subDataElement.id, cocId);
                return value !== undefined ? { dataElement: subDataElement, value: value } : null;
            })
            .compact()
            .maxBy(({ value }) => value);

        if (maxSubItem && globalValue < maxSubItem.value) {
            const msg = i18n.t(
                "A global indicator should be equal to or greater than its maximum sub-indicator: {{-name}} ({{value}})",
                {
                    name: getDataElementName(maxSubItem.dataElement),
                    value: maxSubItem.value,
                    nsSeparator: false,
                }
            );
            return [{ level: "error", message: msg }];
        } else {
            return [];
        }
    }

    validateNonEmptyGlobalsWhenSubsHaveValues(): ValidationItem[] {
        const { config, globalDataElements } = this.data;

        return _(globalDataElements)
            .map((globalDataElement): ValidationItem | null => {
                const isValid = _(globalDataElement.categoryOptionComboIds).every(cocId => {
                    const globalValue = this.getValue(globalDataElement.id, cocId);
                    const globalIsEmpty = !globalValue;

                    if (!globalIsEmpty) {
                        return true;
                    } else {
                        const subDataElements = getSubs(config, globalDataElement.id);
                        const allSubsAreEmpty = _(subDataElements).every(subDataElement => {
                            const subValue = this.getValue(subDataElement.id, cocId);
                            return !subValue;
                        });
                        return allSubsAreEmpty;
                    }
                });

                const msg = i18n.t(
                    "Global indicator with sub-indicators values cannot be empty: {{- name}}",
                    {
                        name: globalDataElement.name,
                        nsSeparator: false,
                    }
                );

                const isPeople = globalDataElement.dataElement.peopleOrBenefit === "people";

                return isValid ? null : { level: isPeople ? "error" : "warning", message: msg };
            })
            .compact()
            .value();
    }

    private getDataValue(dataElementId: string, categoryOptionComboId: string): Maybe<DataValue> {
        const key = getKey(this.data, dataElementId, categoryOptionComboId);
        return this.data.dataValues[key];
    }

    private getValue(dataElementId: string, categoryOptionComboId: string): number | undefined {
        const dataValue = this.getDataValue(dataElementId, categoryOptionComboId);
        return dataValue ? parseFloat(dataValue.value) : undefined;
    }
}

export class GlobalSubsValidator {
    constructor(private data: BasicData) {}

    execute(): ValidationResult {
        const cocIdsMapping = getCocIdsMapping(this.data.config);

        return _(this.data.globalDataElements)
            .filter(de => de.dataElement.peopleOrBenefit === "people")
            .flatMap(globalDataElement => {
                return _.flatMap(globalDataElement.categoryOptionComboIds, cocId => {
                    return this.getGlobalSubValidationData({
                        globalDataElement: globalDataElement,
                        cocId: cocId,
                        cocIdsMapping: cocIdsMapping,
                    });
                });
            })
            .thru(objs => this.getGlobalValidatorValidations(objs))
            .value();
    }

    private getGlobalSubValidationData(options: {
        globalDataElement: GlobalDataElement;
        cocIdsMapping: CocIdsMapping;
        cocId: Id;
    }) {
        const { globalDataElement, cocIdsMapping, cocId } = options;
        const { period } = this.data;

        const strValue = this.getValue(globalDataElement.id, cocId);
        const subDataElements = getSubs(this.data.config, globalDataElement.id);
        const globalValue = strValue ? toFloat(strValue) : 0;
        const relatedCocIds = _.compact(cocIdsMapping[cocId]?.subCocIds || []);

        const subData = _(subDataElements)
            .flatMap(subDataElement => {
                return relatedCocIds.map(cocId => {
                    const key = getKey(this.data, subDataElement.id, cocId);
                    const dv = this.data.dataValues[key];
                    return dv ? { dataElement: subDataElement, value: toFloat(dv.value) } : null;
                });
            })
            .compact()
            .value();

        const subValuesSum = _.sum(subData.map(obj => obj.value));

        if (globalValue < subValuesSum) {
            const operands = _.compact(subData.map(o => o.value));
            const partialSum = operands.length > 1 ? operands.join(" + ") : null;
            const dataElementId = globalDataElement.dataElement.id;
            const reason: ValidationItem["reason"] = {
                id: getReasonId({ period, dataElementId }),
                project: { id: this.data.orgUnitId },
                dataElementId: dataElementId,
                period: period,
            };

            return {
                globalName: globalDataElement.name,
                globalValue: globalValue,
                cocName: cocIdsMapping[cocId]?.name,
                reason,
                subFormula: _.compact([partialSum, subValuesSum]).join(" = "),
            };
        } else {
            return undefined;
        }
    }

    private getValue(dataElementId: string, categoryOptionComboId: string): string | undefined {
        const key = getKey(this.data, dataElementId, categoryOptionComboId);
        const dataValue = this.data.dataValues[key];
        return dataValue?.value;
    }

    private getGlobalValidatorValidations(objs: GlobalSubValidationData[]): ValidationItem[] {
        return _(objs)
            .compact()
            .groupBy(obj => obj.reason.dataElementId)
            .toPairs()
            .map(([_dataElementId, objsForDataElement]): ValidationItem => {
                const problems = objsForDataElement
                    .map(obj => {
                        return i18n.t(
                            "{{-cocName}}: global value ({{value}}) cannot be less than the sum of its sub-indicators ({{subFormula}})",
                            {
                                cocName: obj.cocName,
                                name: obj.globalName,
                                value: obj.globalValue,
                                subFormula: obj.subFormula,
                                nsSeparator: false,
                            }
                        );
                    })
                    .join(", ");

                const referenceObj = objsForDataElement[0];
                const msg = i18n.t("Global indicator {{-name}} - {{-problems}}", {
                    name: referenceObj.globalName,
                    problems: problems,
                    nsSeparator: false,
                });

                return { level: "error", message: msg, reason: referenceObj.reason };
            })
            .value();
    }
}

type CocIdsMapping = Record<string, { name: string; subCocIds: Id[] }>;

function getCocIdsMapping(config: Config): CocIdsMapping {
    const { newMale, newFemale, returningMale, returningFemale } = config.categoryOptionCombos;

    const cocIdsMapping = {
        [newMale.id]: { name: "New/Male", subCocIds: [newMale.id, returningMale.id] },
        [newFemale.id]: { name: "New/Female", subCocIds: [newFemale.id, returningFemale.id] },
        [returningMale.id]: { name: "Returning/Male", subCocIds: [newMale.id, returningMale.id] },
        [returningFemale.id]: {
            name: "Returning/Female",
            subCocIds: [newFemale.id, returningFemale.id],
        },
    };

    return cocIdsMapping;
}

export function getIndexedDataValues(dataValues: DataValue[]): IndexedDataValues {
    return _(dataValues)
        .map(dataValue => {
            const key = getDataValueId(dataValue);
            return [key, dataValue] as [string, DataValue];
        })
        .fromPairs()
        .value();
}

function getKey(
    data: BasicData,
    dataElementId: string,
    categoryOptionComboId: string
): DataValueId {
    return getDataValueId({
        orgUnitId: data.orgUnitId,
        period: data.period,
        dataElementId: dataElementId,
        categoryOptionComboId: categoryOptionComboId,
        attributeOptionComboId: data.attributeOptionComboId,
    });
}

export type Id = string;

type DataValueIdFields =
    | "orgUnitId"
    | "period"
    | "dataElementId"
    | "categoryOptionComboId"
    | "attributeOptionComboId";

export function getDataValueId(dataValue: Pick<DataValue, DataValueIdFields>): string {
    return [
        dataValue.orgUnitId,
        dataValue.period,
        dataValue.dataElementId,
        dataValue.categoryOptionComboId,
        dataValue.attributeOptionComboId,
    ].join(".");
}

type GlobalSubValidationData = ReturnType<GlobalSubsValidator["getGlobalSubValidationData"]>;

export function getDataValuesFromD2(dataValues: DataValueSetsDataValue[]) {
    return dataValues.map(
        (dv): DataValue => ({
            period: dv.period,
            orgUnitId: dv.orgUnit,
            dataElementId: dv.dataElement,
            categoryOptionComboId: dv.categoryOptionCombo,
            attributeOptionComboId: dv.attributeOptionCombo,
            value: dv.value,
            comment: dv.comment,
        })
    );
}

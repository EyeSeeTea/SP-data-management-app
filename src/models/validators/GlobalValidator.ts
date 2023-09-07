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
        const items = new GlobalPeopleSumGreaterThanSubsSumValidator(this.data).execute();
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

                return isValid ? null : { level: isPeople ? "warning" : "error", message: msg };
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

/*
    For global people data elements, validated that:
        - New Global + Returning Global >= New Sub + Returning Sub
    Separate validations for Male and Female, but group the messages by data element.
*/

export class GlobalPeopleSumGreaterThanSubsSumValidator {
    constructor(private data: BasicData) {}

    execute(): ValidationResult {
        return _(this.data.globalDataElements)
            .filter(de => de.dataElement.peopleOrBenefit === "people")
            .thru(globalDataElements => {
                return this.getGlobalSubValidationData({ globalDataElements });
            })
            .thru(objs => this.getGlobalValidatorValidationsGroupedByDataElement(objs))
            .value();
    }

    private getGlobalSubValidationData(options: {
        globalDataElements: GlobalDataElement[];
    }): GlobalSubValidationData[] {
        const { period, config } = this.data;
        const cocs = config.categoryOptionCombos;

        const cocGroups = [
            { name: "Male", relatedCocs: [cocs.newMale, cocs.returningMale] },
            { name: "Female", relatedCocs: [cocs.newFemale, cocs.returningFemale] },
        ];

        return _(options.globalDataElements)
            .flatMap(globalDataElement => {
                return cocGroups.map((cocGroup): GlobalSubValidationData | undefined => {
                    const globalOperands = _(cocGroup.relatedCocs)
                        .map(coc => this.getValue(globalDataElement.id, coc.id))
                        .compact()
                        .value();

                    const subOperands = _(getSubs(config, globalDataElement.id))
                        .flatMap(subDataElement => {
                            return cocGroup.relatedCocs.map(coc => {
                                return this.getValue(subDataElement.id, coc.id);
                            });
                        })
                        .compact()
                        .value();

                    const globalValuesSum = _.sum(globalOperands);
                    const subValuesSum = _.sum(subOperands);

                    if (globalValuesSum < subValuesSum) {
                        const globalParts =
                            globalOperands.length > 1 ? globalOperands.join(" + ") : null;
                        const subParts = subOperands.length > 1 ? subOperands.join(" + ") : null;
                        const dataElementId = globalDataElement.dataElement.id;
                        const reason: GlobalSubValidationData["reason"] = {
                            id: getReasonId({ period, dataElementId }),
                            project: { id: this.data.orgUnitId },
                            dataElementId: dataElementId,
                            period: period,
                        };

                        return {
                            globalName: globalDataElement.name,
                            disaggregation: cocGroup.name,
                            globalFormula: [globalParts, globalValuesSum]
                                .filter(x => x !== null)
                                .join(" = "),
                            subFormula: [subParts, subValuesSum]
                                .filter(x => x !== null)
                                .join(" = "),
                            reason: reason,
                        };
                    } else {
                        return undefined;
                    }
                });
            })
            .compact()
            .value();
    }

    private getValue(dataElementId: string, categoryOptionComboId: string): number {
        const key = getKey(this.data, dataElementId, categoryOptionComboId);
        const dataValue = this.data.dataValues[key];
        const value = dataValue?.value;
        return value ? parseFloat(value) : 0;
    }

    private getGlobalValidatorValidationsGroupedByDataElement(
        globalSubValidationDataItems: GlobalSubValidationData[]
    ): ValidationItem[] {
        return _(globalSubValidationDataItems)
            .compact()
            .groupBy(validationData => validationData.reason.dataElementId)
            .toPairs()
            .map(([_globalDataElementId, dataForDataElement]): ValidationItem => {
                const problems = dataForDataElement
                    .map(data => {
                        return i18n.t(
                            "{{-disaggregation}}: global value ({{globalFormula}}) cannot be less than the sum of its sub-indicators ({{subFormula}})",
                            {
                                disaggregation: data.disaggregation,
                                name: data.globalName,
                                globalFormula: data.globalFormula,
                                subFormula: data.subFormula,
                                nsSeparator: false,
                            }
                        );
                    })
                    .join(", ");

                const referenceObj = dataForDataElement[0];
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

type GlobalSubValidationData = {
    globalName: string;
    disaggregation: string;
    globalFormula: string;
    subFormula: string;
    reason: NonNullable<ValidationItem["reason"]>;
};

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

import { D2Api, DataValueSetsGetRequest, Id } from "../../types/d2-api";
import _ from "lodash";

import Project, { DataSet, DataSetType } from "../Project";
import i18n from "../../locales";
import { DataValue, toFloat, ValidationItem } from "./validator-common";
import { Maybe } from "../../types/utils";
import { Config } from "../Config";
import { getId } from "../../utils/dhis2";
import { DataElementBase, getDataElementName, getGlobal, getSubs } from "../dataElementsSet";

/*
    Validate:

    - A cell for a global value cannot be empty.
    - A global must be at least the value of its maximum sub-indicator (check both directions).
*/

type IndexedDataValues = Record<DataValueId, Maybe<DataValue>>;

type DataValueId = string; // `${dataElementId}-${categoryOptionComboId]`

interface Data {
    config: Config;
    dataValues: IndexedDataValues;
    globalDataElements: GlobalDataElement[];
    period: string;
}

interface GlobalDataElement {
    id: Id;
    name: string;
    categoryOptionComboIds: Id[];
    subs: DataElementBase[];
}

export class GlobalValidator {
    constructor(private data: Data) {}

    static async build(
        api: D2Api,
        project: Project,
        dataSetType: DataSetType,
        period: string
    ): Promise<GlobalValidator> {
        if (!project.orgUnit || !project.dataSets)
            throw new Error("Cannot build validator: missing data");

        const { config } = project;
        const categoryOption = config.categoryOptions[dataSetType];
        const cocIds = categoryOption.categoryOptionCombos.map(coc => coc.id);
        const getSetOptions: DataValueSetsGetRequest = {
            orgUnit: [project.orgUnit.id],
            dataSet: [project.dataSets.target.id],
            period: [period],
            attributeOptionCombo: cocIds,
        };

        const res = await api.dataValues.getSet(getSetOptions).getData();
        const dataValues = res.dataValues.map(dv => ({
            ...dv,
            dataElementId: dv.dataElement,
            categoryOptionComboId: dv.categoryOptionCombo,
        }));

        const indexedDataValues: Data["dataValues"] = getIndexedDataValues(dataValues);
        const dataSet = project.dataSets[dataSetType];
        const globalDataElements = this.getGlobalDataElements(config, dataSet);

        return new GlobalValidator({
            config,
            globalDataElements,
            dataValues: indexedDataValues,
            period,
        });
    }

    private static getGlobalDataElements(config: Config, dataSet: DataSet): GlobalDataElement[] {
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
                return { id: dataElement.id, name, categoryOptionComboIds, subs };
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

    validate(): ValidationItem[] {
        return _.concat(
            this.validateNonEmptyGlobalsWhenSubsHaveValues(),
            this.validateAllGlobalsAreEqualOrGreaterThanMaxSub()
        );
    }

    validateOnSave(dataValue: DataValue): ValidationItem[] {
        return _.concat(
            this.validateGlobalIsEqualOrGreaterThanMaxSub(dataValue),
            this.validateSubIsLessOrEqualThanGlobal(dataValue)
        );
    }

    validateAllGlobalsAreEqualOrGreaterThanMaxSub(): ValidationItem[] {
        const { period, globalDataElements } = this.data;

        return _(globalDataElements)
            .flatMap(globalDataElement => {
                return _.flatMap(globalDataElement.categoryOptionComboIds, cocId => {
                    const dataValue: DataValue = {
                        dataElementId: globalDataElement.id,
                        categoryOptionComboId: cocId,
                        period,
                        value: this.getValue(globalDataElement.id, cocId) || "",
                    };
                    return this.validateGlobalIsEqualOrGreaterThanMaxSub(dataValue);
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
        const key = getKey(globalDataElement.id, cocId);
        const dv = this.data.dataValues[key];
        const globalValue = dv ? parseFloat(dv.value) : undefined;

        if (globalValue !== undefined && subValue > globalValue) {
            const msg = i18n.t(
                "A sub-indicator should be equal to or less than its global indicator:: {{-name}} ({{value}})",
                {
                    name: getDataElementName(globalDataElement),
                    value: globalValue,
                    nsSeparator: false,
                }
            );
            return [["error", msg]];
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
                const key = getKey(subDataElement.id, cocId);
                const dv = this.data.dataValues[key];
                return dv ? { dataElement: subDataElement, value: toFloat(dv.value) } : null;
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
            return [["error", msg]];
        } else {
            return [];
        }
    }

    validateNonEmptyGlobalsWhenSubsHaveValues(): ValidationItem[] {
        const { config, globalDataElements } = this.data;

        return _(globalDataElements)
            .map(globalDataElement => {
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
                    "Global data element with sub-indicators values cannot be empty: {{- name}}",
                    {
                        name: globalDataElement.name,
                        nsSeparator: false,
                    }
                );

                return isValid ? null : (["error", msg] as ValidationItem);
            })
            .compact()
            .value();
    }

    private getValue(dataElementId: string, categoryOptionComboId: string): string | undefined {
        const key = getKey(dataElementId, categoryOptionComboId);
        const dataValue = this.data.dataValues[key];
        return dataValue?.value;
    }
}

function getKey(dataElementId: string, categoryOptionComboId: string): DataValueId {
    return [dataElementId, categoryOptionComboId].join("-");
}

function getIndexedDataValues(dataValues: DataValue[]): IndexedDataValues {
    return _(dataValues)
        .map(dataValue => {
            const key = getKey(dataValue.dataElementId, dataValue.categoryOptionComboId);
            return [key, dataValue] as [string, DataValue];
        })
        .fromPairs()
        .value();
}

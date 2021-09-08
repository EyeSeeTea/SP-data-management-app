import { D2Api, DataValueSetsGetRequest } from "../../types/d2-api";
import _ from "lodash";

import Project, { DataSet, DataSetType } from "../Project";
import i18n from "../../locales";
import { DataValue, toFloat, ValidationItem } from "./validator-common";
import { Maybe } from "../../types/utils";
import { Config } from "../Config";
import { getId } from "../../utils/dhis2";
import { getDataElementName, getGlobal, getSubs } from "../dataElementsSet";

/*
    Validate:

    - A cell for a global value cannot be empty.
    - A global must be at least the value of its maximum sub-indicator (check both directions).
*/

type IndexedDataValues = Record<DataValueId, Maybe<DataValue>>;

type DataValueId = string; // "dataElementId-categoryOptionComboId"

interface Data {
    config: Config;
    dataValues: IndexedDataValues;
    expectedDataElements: GVDataElement[];
}

interface GVDataElement {
    keys: DataValueId[];
    name: string;
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
        const expectedDataElements = this.getExpectedDataElements(config, dataSet);

        return new GlobalValidator({ config, expectedDataElements, dataValues: indexedDataValues });
    }

    private static getExpectedDataElements(config: Config, dataSet: DataSet): GVDataElement[] {
        const dataElementsById = _.keyBy(config.dataElements, de => de.id);

        const expectedDataElements: GVDataElement[] = _(dataSet.dataSetElements)
            .map((dse): GVDataElement | null => {
                const dataElement = dataElementsById[dse.dataElement.id];
                if (!dataElement || dataElement.indicatorType !== "global") return null;
                const categoryOptionComboIds = dse.categoryCombo.categoryOptionCombos.map(getId);
                const keys = categoryOptionComboIds.map(cocId => getKey(dataElement.id, cocId));
                return { keys, name: getDataElementName(dataElement) };
            })
            .compact()
            .value();
        return expectedDataElements;
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

    validateOnSave(dataValue: DataValue): ValidationItem[] {
        return _.concat(
            this.validateGlobalIsEqualOrGreaterThanMaxSub(dataValue),
            this.validateSubIsLessOrEqualThanGlobal(dataValue)
        );
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
                "A sub data element should be equal or less than its global indicator: {{-name}} (value={{value}})",
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
                "A global data element should be equal or greater than its maximum sub-indicator: {{-name}} (value={{value}})",
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

    validate(): ValidationItem[] {
        const { expectedDataElements, dataValues } = this.data;
        const emptyDataElements = expectedDataElements.filter(expectedDataElement => {
            const someDataValueIsEmpty = _.some(
                expectedDataElement.keys,
                key => !dataValues[key]?.value
            );
            return someDataValueIsEmpty;
        });

        return emptyDataElements.map(({ name }) => {
            const msg = i18n.t("Global data element cannot have empty values: {{- name}}", {
                name,
                nsSeparator: false,
            });
            return ["error", msg];
        });
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

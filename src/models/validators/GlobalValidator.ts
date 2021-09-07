import { D2Api, DataValueSetsGetRequest } from "../../types/d2-api";
import _ from "lodash";

import Project, { DataSetType } from "../Project";
import i18n from "../../locales";
import { DataValue, ValidationItem } from "./validator-common";
import { Maybe } from "../../types/utils";
import { Config } from "../Config";
import { getId } from "../../utils/dhis2";

/*
    Validate:

    - A cell for a global value cannot be empty.
    - A global must be at least the value of its maximum sub indicator (check both directions).
*/

type IndexedDataValues = Record<Key, Maybe<DataValue>>;

type Key = string; // "dataElementId-categoryOptionComboId"

interface Data {
    config: Config;
    dataValues: IndexedDataValues;
    expectedDataElements: GVDataElement[];
}

interface GVDataElement {
    keys: Key[];
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

        const dataElementsById = _.keyBy(config.dataElements, de => de.id);
        const expectedDataElements: GVDataElement[] = _(
            project.dataSets[dataSetType].dataSetElements
        )
            .map((dse): GVDataElement | null => {
                const dataElement = dataElementsById[dse.dataElement.id];
                if (!dataElement || dataElement.indicatorType !== "global") return null;
                const categoryOptionComboIds = dse.categoryCombo.categoryOptionCombos.map(getId);
                const keys = categoryOptionComboIds.map(cocId => getKey(dataElement.id, cocId));
                return { keys, name: `[${dataElement.code}] ${dataElement.name}` };
            })
            .compact()
            .value();

        return new GlobalValidator({ config, expectedDataElements, dataValues: indexedDataValues });
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

function getKey(dataElementId: string, categoryOptionComboId: string): Key {
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

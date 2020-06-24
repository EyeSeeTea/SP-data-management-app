import { D2Api, DataValueSetsGetRequest } from "d2-api";
import _ from "lodash";

import Project, { DataSetType } from "../Project";
import i18n from "../../locales";
import { toFloat, DataValue, ValidationItem } from "./validator-common";
import { Maybe } from "../../types/utils";

/*
    Validate only for actual data sets:
        IF actual_value > 1.2 * target_value THEN show warning
*/

interface Data {
    targetDataValues: { [key: string]: Maybe<number> };
}

export class ActualValidator {
    constructor(private data: Data) {}

    static async build(
        api: D2Api,
        project: Project,
        dataSetType: DataSetType,
        period: string
    ): Promise<ActualValidator> {
        if (!project.orgUnit || !project.dataSets)
            throw new Error("Cannot build validator: missing data");

        let targetDataValues: Data["targetDataValues"];

        if (dataSetType === "actual") {
            const targetCo = project.config.categoryOptions.target;
            const targetCocIds = targetCo.categoryOptionCombos.map(coc => coc.id);
            const getSetOptions: DataValueSetsGetRequest = {
                orgUnit: [project.orgUnit.id],
                dataSet: [project.dataSets.target.id],
                period: [period],
                attributeOptionCombo: targetCocIds,
            };
            const res = await api.dataValues.getSet(getSetOptions).getData();
            targetDataValues = _(res.dataValues)
                .map(dataValue => {
                    const key = getKey(dataValue.dataElement, dataValue.categoryOptionCombo);
                    const value = toFloat(dataValue.value);
                    return [key, value] as [string, number];
                })
                .fromPairs()
                .value();
        } else {
            targetDataValues = {};
        }

        return new ActualValidator({ targetDataValues });
    }

    validate(dataValue: DataValue): ValidationItem[] {
        const key = getKey(dataValue.dataElementId, dataValue.categoryOptionComboId);
        const targetValue = this.data.targetDataValues[key];
        if (!targetValue) return [];

        const actualValue = toFloat(dataValue.value);
        const isValid = actualValue <= 1.2 * targetValue;
        const msg: () => string = () =>
            i18n.t(
                "Actual value ({{actualValue}}) should not be greater than 20% of the target value ({{targetValue}})",
                { targetValue: targetValue, actualValue: dataValue.value }
            );

        return isValid ? [] : [["warning", msg()]];
    }
}

function getKey(dataElementId: string, categoryOptionComboId: string) {
    return [dataElementId, categoryOptionComboId].join("-");
}

import { D2Api, DataValueSetsGetRequest, DataValueSetsDataValue } from "d2-api";
import _ from "lodash";

import Project from "./Project";
import i18n from "../locales";

export class Validator {
    newRecurringCocIds: string[];

    constructor(private project: Project, private options: ConstructorOptions) {
        const { categoryCombos } = project.config;
        this.newRecurringCocIds = categoryCombos.genderNewRecurring.categoryOptionCombos.map(
            coc => coc.id
        );
    }

    static async build(
        api: D2Api,
        project: Project,
        options: Pick<ConstructorOptions, "period" | "dataSetId">
    ): Promise<Validator> {
        if (!project.orgUnit || !project.dataSets)
            return new Validator(project, { ...options, targetDataValues: [] });

        const getSetOptions: DataValueSetsGetRequest = {
            orgUnit: [project.orgUnit.id],
            dataSet: [project.dataSets.target.id],
            period: [options.period],
        };
        const res = await api.dataValues.getSet(getSetOptions).getData();
        const targetDataValues = res.dataValues;

        return new Validator(project, { ...options, targetDataValues });
    }

    async validateDataValue(dataValue: DataValue): Promise<ValidationResult> {
        const items: ValidationItem[] = _.concat(
            this.validateTargetActual(dataValue),
            this.validateNewRecurring(dataValue)
        );

        return _(items)
            .groupBy(([key, _msg]) => key)
            .mapValues(pairs => pairs.map(([_key, msg]) => msg))
            .value();
    }

    private validateNewRecurring(dataValue: DataValue): ValidationItem[] {
        const { project, newRecurringCocIds } = this;
        // const isNewRecurringCoc = _(newRecurringCocIds).includes(dataValue.categoryOptionComboId);
        const value = toFloat(dataValue.value) || 0;
        return value < 5 ? [["error", `${value} is less than 5`]] : [];
    }

    private validateTargetActual(dataValue: DataValue): ValidationItem[] {
        const { project } = this;
        const { dataSetId, targetDataValues } = this.options;

        if (!project.dataSets || dataSetId !== project.dataSets.actual.id) return [];

        const targetCo = project.config.categoryOptions.target;
        const targetCocIds = targetCo.categoryOptionCombos.map(coc => coc.id);
        const targetDataValue = targetDataValues.find(
            dv =>
                dv.dataElement === dataValue.dataElementId &&
                dv.categoryOptionCombo === dataValue.categoryOptionComboId &&
                targetCocIds.includes(dv.attributeOptionCombo)
        );

        if (!targetDataValue) return [];

        const targetValue = toFloat(targetDataValue.value) || 0;
        const actualValue = toFloat(dataValue.value) || 0;
        const isValid = actualValue <= 1.2 * targetValue;
        const msg = i18n.t(
            "Actual value ({{actualValue}}) excess over the target value {{targetValue}} is greater than 20%",
            { targetValue: targetDataValue.value, actualValue: dataValue.value }
        );

        return isValid ? [] : [["warning", msg]];
    }
}

function toFloat(s: string): number {
    return parseFloat(s) || 0.0;
}

export interface DataValue {
    dataElementId: string;
    categoryOptionComboId: string;
    value: string;
}

interface ConstructorOptions {
    period: string;
    dataSetId: string;
    targetDataValues: DataValueSetsDataValue[];
}

export interface ValidationResult {
    info?: string[];
    warning?: string[];
    error?: string[];
}

type ValidationItem = [keyof ValidationResult, string];

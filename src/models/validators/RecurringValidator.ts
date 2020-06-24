import { CategoryOptionCombo } from "./../Config";
import { D2Api, DataValueSetsGetRequest, DataValueSetsDataValue } from "d2-api";
import _ from "lodash";

import Project, { DataSetType } from "../Project";
import i18n from "../../locales";
import { getIds } from "../../utils/dhis2";
import {
    toFloat,
    DataValue,
    ValidationItem,
    areSetsEqual,
    getKey,
    formatPeriod,
} from "./validator-common";
import { Config } from "../Config";

/*
    Validate only for recurring values:
        IF recurring_value > SUM(new_values for past periods).
*/

interface Data {
    newDataValues: { [key: string]: DataValueSetsDataValue[] };
}

export class RecurringValidator {
    constructor(private config: Config, private data: Data) {}

    static async build(
        api: D2Api,
        project: Project,
        dataSetType: DataSetType,
        period: string
    ): Promise<RecurringValidator> {
        if (!project.orgUnit || !project.dataSets) throw new Error("Cannot build validator");

        const dataSet = project.dataSets[dataSetType];
        const categoryOptionForDataSetType = project.config.categoryOptions[dataSetType];
        const aocIds = getIds(categoryOptionForDataSetType.categoryOptionCombos);

        const pastPeriods = project
            .getPeriods()
            .filter(projectPeriod => projectPeriod.id < period)
            .map(period => period.id);

        const getSetOptions: DataValueSetsGetRequest = {
            orgUnit: [project.orgUnit.id],
            dataSet: [dataSet.id],
            period: pastPeriods,
            attributeOptionCombo: aocIds,
        };
        const res = await api.dataValues.getSet(getSetOptions).getData();
        const newDataValues = _(res.dataValues)
            .groupBy(dataValue => getKey(dataValue.dataElement, dataValue.categoryOptionCombo))
            .value();

        return new RecurringValidator(project.config, { newDataValues });
    }

    validate(dataValue: DataValue): ValidationItem[] {
        const cocForRelatedNewValue = this.getCategoryOptionComboForRelatedNewValues(dataValue);
        if (!cocForRelatedNewValue) return [];

        const key = getKey(dataValue.dataElementId, cocForRelatedNewValue.id);
        const pastNewDataValues = this.data.newDataValues[key];
        const sumOfNewOnPastPeriods = _.sum(pastNewDataValues.map(dv => toFloat(dv.value)));
        const summatory = pastNewDataValues
            .map(dv => `${formatPeriod(dv.period)} [${toFloat(dv.value)}]`)
            .join(" + ");
        const newValuesSumFormula = summatory
            ? `${summatory} = ${sumOfNewOnPastPeriods}`
            : i18n.t("there is no data for previous periods");
        const recurringValue = toFloat(dataValue.value);
        const isValid = recurringValue <= sumOfNewOnPastPeriods;

        const msg = i18n.t(
            "Recurring value ({{recurringValue}}) cannot be greater than the sum of new values for past periods ({{newValuesSumFormula}})",
            { recurringValue, newValuesSumFormula }
        );

        return isValid ? [] : [["error", msg]];
    }

    getCategoryOptionComboForRelatedNewValues(
        dataValue: DataValue
    ): CategoryOptionCombo | undefined {
        const { config } = this;
        const categoryOptionRecurring = config.categoryOptions.recurring;
        const recurringCocIds = getIds(categoryOptionRecurring.categoryOptionCombos);
        const dataValueIsRecurring = recurringCocIds.includes(dataValue.categoryOptionComboId);
        if (!dataValueIsRecurring) return;

        const dataElement = config.dataElements.find(de => de.id === dataValue.dataElementId);
        if (!dataElement) return;

        const categoryCombo = _(config.categoryCombos)
            .values()
            .find(cc => cc.id === dataElement.categoryCombo.id);
        if (!categoryCombo) return;

        const cocForDataValueRecurring = _(categoryCombo.categoryOptionCombos).find(
            coc => coc.id === dataValue.categoryOptionComboId
        );
        if (!cocForDataValueRecurring) return;

        const categoryOptionIdsForRelatedNew = new Set(
            _(getIds(cocForDataValueRecurring.categoryOptions))
                .without(categoryOptionRecurring.id)
                .push(config.categoryOptions.new.id)
                .value()
        );

        const cocForRelatedNewValue = categoryCombo.categoryOptionCombos.find(coc =>
            areSetsEqual(new Set(getIds(coc.categoryOptions)), categoryOptionIdsForRelatedNew)
        );

        return cocForRelatedNewValue;
    }
}

import { CategoryOptionCombo } from "./../Config";
import { D2Api, DataValueSetsGetRequest, DataValueSetsDataValue } from "../../types/d2-api";
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
import { Maybe } from "../../types/utils";

/*
    Validate only for returning values:
        IF returning_value > SUM(new_values for past periods) + returning_value for first period.
*/

interface Data {
    project: Project;
    config: Config;
    period: string;
    pastDataValuesIndexed: { [key: string]: Maybe<DataValueSetsDataValue[]> };
}

export class RecurringValidator {
    constructor(private data: Data) {}

    static async build(
        api: D2Api,
        project: Project,
        dataSetType: DataSetType,
        period: string
    ): Promise<RecurringValidator> {
        if (!project.orgUnit || !project.dataSets) throw new Error("Cannot build validator");
        const { config } = project;

        const dataSet = project.dataSets[dataSetType];
        const categoryOptionForDataSetType = project.config.categoryOptions[dataSetType];
        const projectPeriods = project.getPeriods();

        const pastPeriods = projectPeriods
            .filter(projectPeriod => projectPeriod.id < period)
            .map(period => period.id);

        const getSetOptions: DataValueSetsGetRequest = {
            orgUnit: [project.orgUnit.id],
            dataSet: [dataSet.id],
            period: pastPeriods,
            attributeOptionCombo: getIds(categoryOptionForDataSetType.categoryOptionCombos),
        };
        const pastDataValues = _.isEmpty(pastPeriods)
            ? []
            : (await api.dataValues.getSet(getSetOptions).getData()).dataValues;
        const pastDataValuesIndexed = _(pastDataValues)
            .groupBy(dataValue => getKey(dataValue.dataElement, dataValue.categoryOptionCombo))
            .value();

        return new RecurringValidator({ project, config, period, pastDataValuesIndexed });
    }

    isFirstPeriod(dataValue: { period: string }) {
        const projectPeriods = this.data.project.getPeriods();
        const firstProjectPeriod = _(projectPeriods).get(0, null);
        return firstProjectPeriod ? firstProjectPeriod.id === dataValue.period : false;
    }

    validate(dataValue: DataValue): ValidationItem[] {
        if (this.isFirstPeriod({ period: this.data.period })) return [];

        const cocForRelatedNewValue = this.getCategoryOptionComboForRelatedNew(dataValue);
        if (!cocForRelatedNewValue) return [];

        const newKey = getKey(dataValue.dataElementId, cocForRelatedNewValue.id);
        const returningKey = getKey(dataValue.dataElementId, dataValue.categoryOptionComboId);

        const newDataValues = this.data.pastDataValuesIndexed[newKey] || [];
        const returningDataValues = _(this.data.pastDataValuesIndexed[returningKey] || [])
            .filter(dataValue => this.isFirstPeriod(dataValue))
            .value();
        const pastDataValues = _.concat(newDataValues, returningDataValues);
        const maxValue = _.sum(pastDataValues.map(dv => toFloat(dv.value)));

        const summatory = _(pastDataValues)
            .sortBy(dv => dv.period)
            .map(dv => `${formatPeriod(dv.period)} [${toFloat(dv.value)}]`)
            .join(" + ");
        const newValuesSumFormula = summatory
            ? `${summatory} = ${maxValue}`
            : i18n.t("there is no data for previous periods");
        const returningValue = toFloat(dataValue.value);
        const isValid = returningValue <= maxValue;

        const msg = i18n.t(
            "Returning value ({{returningValue}}) cannot be greater than the sum of initial returning + new values for past periods: {{newValuesSumFormula}}",
            { returningValue, newValuesSumFormula }
        );

        return isValid ? [] : [["error", msg]];
    }

    getCategoryOptionComboForRelatedNew(dataValue: DataValue): CategoryOptionCombo | undefined {
        const { config } = this.data;
        const categoryOptionRecurring = config.categoryOptions.recurring;
        const recurringCocIds = getIds(categoryOptionRecurring.categoryOptionCombos);
        const dataValueIsRecurring = recurringCocIds.includes(dataValue.categoryOptionComboId);
        if (!dataValueIsRecurring) return;

        const allCategoryOptionCombos = _(config.allCategoryCombos)
            .flatMap(cc => cc.categoryOptionCombos)
            .value();

        const cocForDataValueRecurring = allCategoryOptionCombos.find(
            coc => coc.id === dataValue.categoryOptionComboId
        );
        if (!cocForDataValueRecurring) return;

        const categoryOptionIdsForRelatedNew = new Set(
            _(getIds(cocForDataValueRecurring.categoryOptions))
                .without(categoryOptionRecurring.id)
                .push(config.categoryOptions.new.id)
                .value()
        );

        const cocsForRelatedNewValue = allCategoryOptionCombos.filter(coc =>
            areSetsEqual(new Set(getIds(coc.categoryOptions)), categoryOptionIdsForRelatedNew)
        );
        if (cocsForRelatedNewValue.length > 1) console.error("Multiple cocs found for related new");

        return cocsForRelatedNewValue[0];
    }
}

import moment from "moment";
import { CategoryOptionCombo } from "./../Config";
import { D2Api, DataValueSetsGetRequest, DataValueSetsDataValue, Id } from "../../types/d2-api";
import _ from "lodash";

import Project, { DataSetType, monthFormat } from "../Project";
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
    pastDataValuesIndexed: { [dataValueKey: string]: Maybe<DataValueSetsDataValue[]> };
}

interface RelatedProjects {
    orgUnitIds: Id[];
    dataSetIds: Id[];
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
        const categoryOptionForDataSetType = project.config.categoryOptions[dataSetType];
        const relatedProjects = await this.getRelatedProjects(api, project, dataSetType);

        const getSetOptions: DataValueSetsGetRequest = {
            orgUnit: relatedProjects.orgUnitIds,
            dataSet: relatedProjects.dataSetIds,
            startDate: "1970",
            endDate: moment(period, monthFormat).format("YYYY-MM-DD"),
            attributeOptionCombo: getIds(categoryOptionForDataSetType.categoryOptionCombos),
        };

        const { dataValues: pastDataValues } = await api.dataValues.getSet(getSetOptions).getData();

        const pastDataValuesIndexed = _(pastDataValues)
            .groupBy(dataValue => getKey(dataValue.dataElement, dataValue.categoryOptionCombo))
            .value();

        return new RecurringValidator({ project, config, period, pastDataValuesIndexed });
    }

    static async getRelatedProjects(
        api: D2Api,
        project: Project,
        dataSetType: DataSetType
    ): Promise<RelatedProjects> {
        const { organisationUnits } = await api.metadata
            .get({
                organisationUnits: {
                    fields: { id: true },
                    filter: { code: { $like: project.awardNumber } },
                },
            })
            .getData();

        const dataSetCodes = organisationUnits.map(ou => `${ou.id}_${dataSetType.toUpperCase()}`);

        const { dataSets } = await api.metadata
            .get({
                dataSets: {
                    fields: { id: true },
                    filter: { code: { in: dataSetCodes } },
                },
            })
            .getData();

        return {
            orgUnitIds: organisationUnits.map(ou => ou.id),
            dataSetIds: dataSets.map(ou => ou.id),
        };
    }

    validate(dataValue: DataValue): ValidationItem[] {
        const cocForRelatedNewValue = this.getCategoryOptionComboForRelatedNew(dataValue);
        if (!cocForRelatedNewValue) return [];

        const newKey = getKey(dataValue.dataElementId, cocForRelatedNewValue.id);
        const newDataValues = this.data.pastDataValuesIndexed[newKey] || [];
        const limitValue = _.sum(newDataValues.map(dv => toFloat(dv.value)));

        const formula = _(newDataValues)
            .sortBy(dv => dv.period)
            .filter(dv => dv.value !== "0")
            .map(dv => `${formatPeriod(dv.period)} [${toFloat(dv.value)}]`)
            .join(" + ");

        const newValuesSumFormula = formula
            ? `${formula} = ${limitValue}`
            : i18n.t("there is no data for previous periods");

        const returningValue = toFloat(dataValue.value);
        const isValid = returningValue <= limitValue;

        const msg = i18n.t(
            "Returning value ({{returningValue}}) cannot be greater than the sum of <new> values for past periods: {{newValuesSumFormula}}",
            { returningValue, newValuesSumFormula, nsSeparator: false }
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

import moment from "moment";
import { CategoryOption, CategoryOptionCombo } from "./../Config";
import { D2Api, DataValueSetsGetRequest, DataValueSetsDataValue, Id } from "../../types/d2-api";
import _ from "lodash";

import Project, { DataSetType, monthFormat } from "../Project";
import i18n from "../../locales";
import { getId, getIds } from "../../utils/dhis2";
import { toFloat, DataValue, ValidationItem, getKey, formatPeriod } from "./validator-common";
import { Config } from "../Config";
import { Maybe } from "../../types/utils";
import ProjectDb from "../ProjectDb";

/*
    Validate only for returning values:
        IF returning_value > SUM(new_values for past periods) + returning_value for first period.
*/

interface Data {
    api: D2Api;
    project: Project;
    categoryOptionForDataSetType: CategoryOption;
    config: Config;
    period: string;
    categoryOptionCombos: CategoryOptionCombo[];
    pastDataValuesIndexed: { [dataValueKey: string]: Maybe<DataValueSetsDataValue[]> };
    allProjectsInPlatform: boolean;
}

interface RelatedProjects {
    orgUnitIds: Id[];
    dataSetIds: Id[];
    allProjectsInPlatform: boolean;
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

        const categoryOptionCombos = _(config.allCategoryCombos)
            .flatMap(cc => cc.categoryOptionCombos)
            .value();

        return new RecurringValidator({
            api,
            project,
            categoryOptionForDataSetType,
            config,
            period,
            pastDataValuesIndexed,
            categoryOptionCombos,
            allProjectsInPlatform: relatedProjects.allProjectsInPlatform,
        });
    }

    static async getRelatedProjects(
        api: D2Api,
        project: Project,
        dataSetType: DataSetType
    ): Promise<RelatedProjects> {
        const { organisationUnits } = await api.metadata
            .get({
                organisationUnits: {
                    fields: { id: true, code: true },
                    filter: { code: { $like: project.awardNumber } },
                },
            })
            .getData();

        const allProjectsInPlatform = areSubsequentLetteringsComplete(organisationUnits, project);

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
            allProjectsInPlatform,
        };
    }

    async validate(dataValue: DataValue): Promise<ValidationItem[]> {
        const cocsForRelatedNewValue = this.getCategoryOptionCombosForRelatedNew(dataValue);
        if (_.isEmpty(cocsForRelatedNewValue)) return [];

        const returningValueResult = await this.getReturningValue(dataValue);
        if (!returningValueResult) return [];
        const { sum: returningValue, values: returningValues } = returningValueResult;

        const newDataValues = _.flatMap(cocsForRelatedNewValue, cocForRelatedNewValue => {
            const newKey = getKey(dataValue.dataElementId, cocForRelatedNewValue.id);
            return this.data.pastDataValuesIndexed[newKey] || [];
        });

        const limitValue = _.sum(newDataValues.map(dv => toFloat(dv.value)));

        const formula = _(newDataValues)
            .sortBy(dv => dv.period)
            .filter(dv => dv.value !== "0")
            .map(dv => `${formatPeriod(dv.period)} [${toFloat(dv.value)}]`)
            .join(" + ");

        const newValuesSumFormula = formula
            ? `${formula} = ${limitValue}`
            : i18n.t("there is no data for previous periods");

        const isValid = returningValue <= limitValue;

        if (isValid) {
            return [];
        } else if (this.data.allProjectsInPlatform) {
            const values = returningValues.join(" + ");
            const msg =
                newDataValues.length > 0
                    ? i18n.t(
                          "Total returning values ({{values}} = {{returningValue}}) cannot be greater than the sum of <new> values for past periods: {{newValuesSumFormula}}",
                          { values, returningValue, newValuesSumFormula, nsSeparator: false }
                      )
                    : i18n.t(
                          "Returning value ({{returningValue}}) cannot be greater than the sum of <new> values for past periods: {{newValuesSumFormula}}",
                          { returningValue, newValuesSumFormula, nsSeparator: false }
                      );
            return [["error", msg]];
        } else {
            const msg = i18n.t(
                "Returning value ({{returningValue}}) is greater than the sum of <new> values for past periods in projects stored in this platform: {{newValuesSumFormula}}",
                { returningValue, newValuesSumFormula, nsSeparator: false }
            );
            return [["warning", msg]];
        }
    }

    private async getReturningValue(
        dataValue: DataValue
    ): Promise<{ sum: number; values: string[] } | undefined> {
        const { categoryOptionComboId } = dataValue;
        const cocsById = _.keyBy(this.data.categoryOptionCombos, coc => coc.id);
        const categoryOptionCombo = cocsById[categoryOptionComboId];
        if (!categoryOptionCombo) return undefined;

        const { config, project, period, categoryOptionForDataSetType, api } = this.data;
        const categoryOptionIds = _(categoryOptionCombo.categoryOptions)
            .map(co => co.id)
            .difference(config.categories.covid19.categoryOptions.map(getId))
            .value();
        const cocsForValue = this.getCategoryOptionCombosForCategoryOptions(categoryOptionIds);
        const cocsToRequest = cocsForValue.filter(coc => coc.id !== categoryOptionComboId);

        const getSetOptions: DataValueSetsGetRequest = {
            orgUnit: _.compact([project.orgUnit?.id]),
            dataSet: _.compact([project.dataSets?.target?.id]),
            period: [period],
            attributeOptionCombo: getIds(categoryOptionForDataSetType.categoryOptionCombos),
        };

        const dataValues = _(cocsToRequest).isEmpty()
            ? []
            : (await api.dataValues.getSet(getSetOptions).getData()).dataValues;

        const dataValuesToSum = [
            dataValue,
            ...dataValues.filter(dv =>
                cocsToRequest.map(coc => coc.id).includes(dv.categoryOptionCombo)
            ),
        ];

        const values = dataValuesToSum.map(dv => dv.value);
        const sum = _.sum(values.map(value => toFloat(value)));

        return { sum, values };
    }

    getCategoryOptionCombosForRelatedNew(dataValue: DataValue): CategoryOptionCombo[] {
        const { config } = this.data;
        const categoryOptionRecurring = config.categoryOptions.recurring;
        const recurringCocIds = getIds(categoryOptionRecurring.categoryOptionCombos);
        const dataValueIsRecurring = recurringCocIds.includes(dataValue.categoryOptionComboId);
        if (!dataValueIsRecurring) return [];

        const cocForDataValueRecurring = this.data.categoryOptionCombos.find(
            coc => coc.id === dataValue.categoryOptionComboId
        );
        if (!cocForDataValueRecurring) return [];

        // Get cocs replacing recurring -> new
        const coIdsForRelatedNew = _(getIds(cocForDataValueRecurring.categoryOptions))
            .without(categoryOptionRecurring.id)
            .push(config.categoryOptions.new.id)
            .value();

        return this.getCategoryOptionCombosForCategoryOptions(coIdsForRelatedNew);
    }

    getCategoryOptionCombosForCategoryOptions(categoryOptionIds: Id[]): CategoryOptionCombo[] {
        const excludedCategoryOptionIdsByCategoryOptionId = _(this.data.config.categories)
            .values()
            .filter(category => category.dataDimensionType === "DISAGGREGATION")
            .flatMap(category =>
                category.categoryOptions.map(co => {
                    const excludedIds = _.without(category.categoryOptions.map(getId), co.id);
                    return [co.id, excludedIds] as [Id, Id[]];
                })
            )
            .fromPairs()
            .value();

        // Exclude cocs that contain a different category option in an existing dataValue.coc->category
        const excludedCoIds = _(categoryOptionIds)
            .flatMap(coId => excludedCategoryOptionIdsByCategoryOptionId[coId])
            .uniq()
            .value();

        return this.data.categoryOptionCombos.filter(coc => {
            const coIds = coc.categoryOptions.map(getId);
            const cocHasForbiddenCategoryOptions = _.intersection(coIds, excludedCoIds).length > 0;
            return !cocHasForbiddenCategoryOptions;
        });
    }
}

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/* Check if we have all the previous projects looking at the subsequent lettering of related projects.

    Example. If our project has code "12345AC", we expect to also have projects "12345AA" and "12345AB".

    Implementation: Convert the subsequent lettering to its integer representation
    (ex: "BD" -> (26^1 * 1) + (26^0 * 3) = 26 + 3 = 29) and check if we have all
    the codes between "AA" and "AC".
*/
function areSubsequentLetteringsComplete(
    organisationUnits: Array<{ code: string }>,
    project: Project
): boolean {
    const projectSubcode = project.subsequentLettering.toLocaleUpperCase();

    const subcodeAsInteger = _(projectSubcode.split(""))
        .reverse()
        .map((c, idx) => letters.indexOf(c) * Math.pow(letters.length, idx))
        .sum();

    const subcodes = _(organisationUnits)
        .map(orgUnit => ProjectDb.getCodeInfo(orgUnit.code))
        .map(info => info.subsequentLettering.toLocaleUpperCase())
        .filter(subcode => subcode < projectSubcode)
        .uniq()
        .value();

    return subcodes.length === subcodeAsInteger;
}

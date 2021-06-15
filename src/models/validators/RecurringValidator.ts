import _ from "lodash";
import moment from "moment";

import { CategoryOption, CategoryOptionCombo } from "./../Config";
import { D2Api, DataValueSetsGetRequest, Id } from "../../types/d2-api";
import Project, { DataSetType, monthFormat } from "../Project";
import i18n from "../../locales";
import { getId, getIds } from "../../utils/dhis2";
import {
    toFloat,
    DataValue,
    ValidationItem,
    getKey,
    formatPeriod,
    isSuperset,
    getDataValueFromD2,
} from "./validator-common";
import { Config } from "../Config";
import { Maybe } from "../../types/utils";
import ProjectDb from "../ProjectDb";
import { lexRange } from "../../utils/lex-ranges";

/*
    Validations for returning data values:

        SUM(returningValuesCurrentPeriod) <= SUM(newValuesPastPeriods).
            Use subsets of category options to sum values.

        Cases:

        - If dataValue is non-COVID-19 disaggregated -> Check the current disaggregation.
        - If dataValue is COVID-19 disaggregated:
            - If all related projects have the same disaggregation for DE -> check with COVID disaggregation
            - Otherwise, remove COVID disaggregation and check.
*/

interface Data {
    api: D2Api;
    project: Project;
    categoryOptionForDataSetType: CategoryOption;
    config: Config;
    period: string;
    categoryOptionCombos: Record<Id, CategoryOptionCombo>;
    pastDataValuesIndexed: { [dataValueKey: string]: DataValue[] };
    relatedProjects: RelatedProjects;
    allProjectsInPlatform: boolean;
}

interface DataSet {
    id: Id;
    dataSetElements: Array<{
        dataElement: { id: Id };
        categoryCombo: { id: Id };
    }>;
}
interface RelatedProjects {
    orgUnitIds: Id[];
    dataSets: DataSet[];
    missingProjects: string[];
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
            dataSet: relatedProjects.dataSets.map(getId),
            startDate: "1970",
            endDate: moment(period, monthFormat).format("YYYY-MM-DD"),
            attributeOptionCombo: getIds(categoryOptionForDataSetType.categoryOptionCombos),
        };

        const { dataValues: pastDataValues } = await api.dataValues.getSet(getSetOptions).getData();

        const pastDataValuesIndexed = _(pastDataValues)
            .map(getDataValueFromD2)
            .groupBy(dataValue => getKey(dataValue.dataElementId, dataValue.categoryOptionComboId))
            .value();

        const categoryOptionCombos = _(config.allCategoryCombos)
            .flatMap(cc => cc.categoryOptionCombos)
            .keyBy(getId)
            .value();

        return new RecurringValidator({
            api,
            project,
            categoryOptionForDataSetType,
            config,
            period,
            pastDataValuesIndexed,
            categoryOptionCombos,
            relatedProjects,
            allProjectsInPlatform: _.isEmpty(relatedProjects.missingProjects),
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

        const missingProjects = getMissingProjectVersions(organisationUnits, project);

        const dataSetCodes = organisationUnits.map(ou => `${ou.id}_${dataSetType.toUpperCase()}`);

        const { dataSets } = await api.metadata
            .get({
                dataSets: {
                    fields: {
                        id: true,
                        dataSetElements: { dataElement: { id: true }, categoryCombo: { id: true } },
                    },
                    filter: { code: { in: dataSetCodes } },
                },
            })
            .getData();

        return {
            orgUnitIds: organisationUnits.map(ou => ou.id),
            dataSets,
            missingProjects,
        };
    }

    async validate(dataValue: DataValue): Promise<ValidationItem[]> {
        const { config } = this.data;

        const categoryOptionCombo = this.getCocFromId(dataValue.categoryOptionComboId);
        if (!categoryOptionCombo || !this.isDataValueRecurring(dataValue)) return [];

        const dataValues: DataValue[] = await this.getDataValues(dataValue);
        const covidCategoryOptionIds = config.categories.covid19.categoryOptions.map(getId);
        const dataValueCatOptionsIds = categoryOptionCombo.categoryOptions.map(getId);
        const categoryOptionIdsWithoutCovid = _(categoryOptionCombo.categoryOptions)
            .map(getId)
            .difference(covidCategoryOptionIds)
            .value();

        const hasCovid = !_.isEqual(dataValueCatOptionsIds, categoryOptionIdsWithoutCovid);

        if (hasCovid && !this.hasSameDisaggregationForAllProjects(dataValue)) {
            // Special case: the COVID-19 disaggregation for this data element in related projects
            // do not match. Therefore, we cannot validate the specific value for COVID,
            // only the totals with and without COVID disaggregation.
            return this.validateCategoryOptions(categoryOptionIdsWithoutCovid, dataValues);
        } else {
            return this.validateCategoryOptions(dataValueCatOptionsIds, dataValues);
        }
    }

    private isDataValueRecurring(dataValue: DataValue): boolean {
        const { config } = this.data;
        const categoryOptionCombo = this.getCocFromId(dataValue.categoryOptionComboId);
        if (!categoryOptionCombo) return false;

        const dataValueCatOptionsIds = categoryOptionCombo.categoryOptions.map(getId);
        const isRecurring = dataValueCatOptionsIds.includes(config.categoryOptions.recurring.id);
        return isRecurring;
    }

    private async getDataValues(dataValue: DataValue) {
        const currentPeriodPersistedDataValues = await this.getDataValuesForCurrentPeriod();
        const currentPeriodDataValues = currentPeriodPersistedDataValues.filter(
            dv => dv.categoryOptionComboId !== dataValue.categoryOptionComboId
        );

        const dataValues: DataValue[] = _(this.data.pastDataValuesIndexed)
            .values()
            .flatten()
            .concat(currentPeriodDataValues)
            .filter(dv => dv.dataElementId === dataValue.dataElementId)
            .concat([dataValue])
            .value();
        return dataValues;
    }

    hasSameDisaggregationForAllProjects(dataValue: DataValue) {
        const categoryComboIds = _(this.data.relatedProjects.dataSets)
            .map(dataSet => {
                const dse = dataSet.dataSetElements.find(dse => {
                    return dse.dataElement.id === dataValue.dataElementId;
                });
                return dse?.categoryCombo.id;
            })
            .compact()
            .uniq();

        return categoryComboIds.size() <= 1;
    }

    validateCategoryOptions(categoryOptionIds: Id[], values: DataValue[]): ValidationItem[] {
        const { config } = this.data;
        const returning = this.getAggregation(categoryOptionIds, values, "current-month");
        if (!returning) return [];

        const categoryOptionIdsForNew = _(categoryOptionIds)
            .difference([config.categoryOptions.recurring.id])
            .union([config.categoryOptions.new.id])
            .value();
        const pastResult = this.getAggregation(categoryOptionIdsForNew, values, "past-months");
        if (!pastResult) return [];

        const { sum: pastValue, formula: pastValuesFormula } = pastResult;

        const isValid = returning.sum <= pastValue;

        console.debug("RecurringValidator", { isValid, retuning: returning, pastResult });

        if (isValid) {
            return [];
        } else if (this.data.allProjectsInPlatform) {
            const returningInfo =
                returning.values.length > 1
                    ? `${returning.formula}} = ${returning.sum}`
                    : returning.sum;
            const msg = i18n.t(
                "Returning value ({{returningInfo}}) cannot be greater than the sum of New values for past periods: {{pastValuesFormula}} = {{pastValue}}",
                {
                    returningInfo,
                    pastValuesFormula,
                    pastValue,
                    nsSeparator: false,
                }
            );
            return [["error", msg]];
        } else {
            const missingProjects = this.data.relatedProjects.missingProjects.join(", ");
            const msg = i18n.t(
                "Returning value ({{returningValue}}) is greater than the sum of New values for past periods in projects stored in Platform: {{pastValuesFormula}} = {{pastValue}} (there is no {{missingProjects}} version(s) of this project)",
                {
                    returningValue: returning.sum,
                    pastValuesFormula,
                    missingProjects,
                    pastValue,
                    nsSeparator: false,
                }
            );
            return [["warning", msg]];
        }
    }

    private async getDataValuesForCurrentPeriod(): Promise<DataValue[]> {
        const { project, period, categoryOptionForDataSetType, api } = this.data;

        const getSetOptions: DataValueSetsGetRequest = {
            orgUnit: _.compact([project.orgUnit?.id]),
            dataSet: _.compact([project.dataSets?.target?.id]),
            period: [period],
            attributeOptionCombo: getIds(categoryOptionForDataSetType.categoryOptionCombos),
        };

        const res = await api.dataValues.getSet(getSetOptions).getData();

        return res.dataValues.map(getDataValueFromD2);
    }

    private getAggregation(
        categoryOptionIds: Id[],
        dataValues: DataValue[],
        periods: "current-month" | "past-months"
    ): Maybe<{ sum: number; values: string[]; formula: string }> {
        const { period } = this.data;

        const dataValuesToSum = dataValues.filter(dv => {
            if (periods === "current-month" && dv.period !== period) {
                return false;
            } else if (periods === "past-months" && dv.period >= period) {
                return false;
            } else {
                const coc = this.getCocFromId(dv.categoryOptionComboId);
                return coc ? isSuperset(coc.categoryOptions.map(getId), categoryOptionIds) : false;
            }
        });

        const values = dataValuesToSum.map(dv => dv.value);
        const sum = _.sum(values.map(value => toFloat(value)));

        const baseFormula = _(dataValuesToSum)
            .sortBy(dv => dv.period)
            .filter(dv => dv.value !== "0")
            .map(dv => {
                const info = _.compact([formatPeriod(dv.period), this.getCovidInfo(dv)]).join(":");
                return `${toFloat(dv.value)} [${info}]`;
            })
            .join(" + ");

        const formula = baseFormula || i18n.t("No data for previous periods");

        return { sum, values, formula };
    }

    getCovidInfo(dataValue: DataValue): Maybe<string> {
        const { config } = this.data;
        const { covid19, nonCovid19 } = config.categoryOptions;
        const coc = this.getCocFromId(dataValue.categoryOptionComboId);
        const categoryOptionIds = coc ? coc.categoryOptions.map(getId) : [];

        if (!coc) {
            return;
        } else if (categoryOptionIds.includes(covid19.id)) {
            return i18n.t("COVID-19");
        } else if (categoryOptionIds.includes(nonCovid19.id)) {
            return i18n.t("Non-COVID-19");
        } else {
            return;
        }
    }

    getCocFromId(cocId: Id): Maybe<CategoryOptionCombo> {
        return _(this.data.categoryOptionCombos).get(cocId, undefined);
    }
}

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/* Check if we have all the previous projects looking at the subsequent lettering of related projects.

    Example. If our project has code "12345AC", we expect to also have projects "12345AA" and "12345AB".

    Implementation: Convert the subsequent lettering to its integer representation
    (ex: "BD" -> (26^1 * 1) + (26^0 * 3) = 26 + 3 = 29) and check if we have all
    the codes between "AA" and "AC".
*/
function getMissingProjectVersions(
    organisationUnits: Array<{ code: string }>,
    project: Project
): string[] {
    const projectSubcode = project.subsequentLettering.toLocaleUpperCase();
    const requiredVersion = lexRange(letters, "AA", projectSubcode);

    const existingVersions = organisationUnits
        .map(orgUnit => ProjectDb.getCodeInfo(orgUnit.code))
        .map(info => info.subsequentLettering.toLocaleUpperCase());

    return _.difference(requiredVersion, existingVersions);
}

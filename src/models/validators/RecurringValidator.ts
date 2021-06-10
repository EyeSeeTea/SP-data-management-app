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
import ProjectDb from "../ProjectDb";
import { lexRange } from "../../utils/lex-ranges";

/*
    Validate only for returning values:
        IF returning_value > SUM(new_values for past periods) + returning_value for first period.
*/

interface Data {
    project: Project;
    config: Config;
    period: string;
    pastDataValuesIndexed: { [dataValueKey: string]: Maybe<DataValueSetsDataValue[]> };
    missingProjects: string[];
    allProjectsInPlatform: boolean;
}

interface RelatedProjects {
    orgUnitIds: Id[];
    dataSetIds: Id[];
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
            dataSet: relatedProjects.dataSetIds,
            startDate: "1970",
            endDate: moment(period, monthFormat).format("YYYY-MM-DD"),
            attributeOptionCombo: getIds(categoryOptionForDataSetType.categoryOptionCombos),
        };

        const { dataValues: pastDataValues } = await api.dataValues.getSet(getSetOptions).getData();

        const pastDataValuesIndexed = _(pastDataValues)
            .groupBy(dataValue => getKey(dataValue.dataElement, dataValue.categoryOptionCombo))
            .value();

        return new RecurringValidator({
            project,
            config,
            period,
            pastDataValuesIndexed,
            missingProjects: relatedProjects.missingProjects,
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
                    fields: { id: true },
                    filter: { code: { in: dataSetCodes } },
                },
            })
            .getData();

        return {
            orgUnitIds: organisationUnits.map(ou => ou.id),
            dataSetIds: dataSets.map(ou => ou.id),
            missingProjects,
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

        if (isValid) {
            return [];
        } else if (this.data.allProjectsInPlatform) {
            const msg = i18n.t(
                "Returning value ({{returningValue}}) cannot be greater than the sum of New values for past periods: {{newValuesSumFormula}}",
                { returningValue, newValuesSumFormula, nsSeparator: false }
            );
            return [["error", msg]];
        } else {
            const msg = i18n.t(
                "Returning value ({{returningValue}}) is greater than the sum of New values for past periods in projects stored in Platform (there is no {{missingProjects}} version(s) of this project)",
                {
                    returningValue,
                    newValuesSumFormula,
                    missingProjects: this.data.missingProjects.join(", "),
                    nsSeparator: false,
                }
            );
            return [["warning", msg]];
        }
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

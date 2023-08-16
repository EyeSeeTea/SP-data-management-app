import fs from "fs";
import { D2Api, DataValueSetsDataValue, DataValueSetsGetRequest } from "../../types/d2-api";
import _ from "lodash";

import { DataSet, DataSetType, ProjectBasic } from "../Project";
import i18n from "../../locales";
import { DataValue, toFloat, ValidationItem } from "./validator-common";
import { Maybe } from "../../types/utils";
import { baseConfig, Config } from "../Config";
import { getId } from "../../utils/dhis2";
import { DataElementBase, getDataElementName, getGlobal, getSubs } from "../dataElementsSet";
import { DataEntry } from "../DataEntry";
import { assert } from "../../scripts/common";
import moment from "moment";
import { dataSetFields } from "../ProjectDb";
import { ProjectNotification } from "../ProjectNotification";
import { promiseMap } from "../../migrations/utils";

/*
    Validate:

    - A cell for a global value cannot be empty.
    - A global must be at least the value of its maximum sub-indicator (check both directions).
*/

type IndexedDataValues = Record<DataValueId, Maybe<DataValue>>;

type DataValueId = string; // `${dataElementId}-${categoryOptionComboId]`

interface Data {
    project: ProjectBasic;
    config: Config;
    dataValues: IndexedDataValues;
    dataSetType: DataSetType;
    globalDataElements: GlobalDataElement[];
    period: string;
}

interface GlobalDataElement {
    id: Id;
    name: string;
    categoryOptionComboIds: Id[];
    subs: DataElementBase[];
    dataElement: DataElementBase;
}

export class GlobalValidator {
    constructor(private data: Data) {}

    static async build(
        api: D2Api,
        project: ProjectBasic,
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
        const globalDataElements = this.getGlobalDataElements(config, dataSet);

        return new GlobalValidator({
            project: project,
            config,
            dataSetType: dataSetType,
            globalDataElements,
            dataValues: indexedDataValues,
            period,
        });
    }

    static getGlobalDataElements(config: Config, dataSet: DataSet): GlobalDataElement[] {
        const dataElementsById = _.keyBy(config.dataElements, de => de.id);

        const projectDataElements = _(dataSet.dataSetElements)
            .map(dse => dataElementsById[dse.dataElement.id])
            .compact()
            .value();

        const globalDataElements: GlobalDataElement[] = _(dataSet.dataSetElements)
            .map((dse): GlobalDataElement | null => {
                const dataElement = dataElementsById[dse.dataElement.id];
                if (!dataElement || dataElement.indicatorType !== "global") return null;
                const categoryOptionComboIds = dse.categoryCombo.categoryOptionCombos.map(getId);
                const allSubDataElements = getSubs(config, dataElement.id);
                const subs = _.intersectionBy(projectDataElements, allSubDataElements, de => de.id);
                const name = getDataElementName(dataElement);

                return {
                    id: dataElement.id,
                    name,
                    categoryOptionComboIds,
                    subs,
                    dataElement: dataElement,
                };
            })
            .compact()
            .value();

        return globalDataElements;
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

    async validate(): Promise<ValidationItem[]> {
        return _.concat(
            this.validateNonEmptyGlobalsWhenSubsHaveValues(),
            this.validateAllGlobalsAreEqualOrGreaterThanMaxSub(),
            await this.validateThatGlobalsAreLessThanSumOfSubsForNewAndReturning()
        );
    }

    validateOnSave(dataValue: DataValue): ValidationItem[] {
        return _.concat(
            this.validateGlobalIsEqualOrGreaterThanMaxSub(dataValue),
            this.validateSubIsLessOrEqualThanGlobal(dataValue)
        );
    }

    async validateThatGlobalsAreLessThanSumOfSubsForNewAndReturning(): Promise<ValidationItem[]> {
        const { period, project, dataSetType } = this.data;
        const items = this.getItemsForValidateThatGlobalsAreLessThanSumOfSubsForNewAndReturning();
        const dataEntry = new DataEntry(project.api, project, dataSetType, period);
        const pendingReasonIds = _.keys(await dataEntry.getReasons(items));

        return items.filter(item => !item.reason || pendingReasonIds.includes(item.reason.id));
    }

    getItemsForValidateThatGlobalsAreLessThanSumOfSubsForNewAndReturning() {
        const { period, globalDataElements, project } = this.data;
        const cocIdsMapping = getCocIdsMapping(this.data.config);

        return _(globalDataElements)
            .filter(de => de.dataElement.peopleOrBenefit === "people")
            .flatMap(globalDataElement => {
                return _.flatMap(
                    globalDataElement.categoryOptionComboIds,
                    (cocId): ValidationItem[] => {
                        const strValue = this.getValue(globalDataElement.id, cocId) || "";
                        if (!strValue) return [];

                        const subDataElements = getSubs(this.data.config, globalDataElement.id);
                        const globalValue = toFloat(strValue);
                        const relatedCocIds = _.compact(cocIdsMapping[cocId]?.subCocIds || []);

                        const subData = _(subDataElements)
                            .flatMap(subDataElement => {
                                return relatedCocIds.map(cocId => {
                                    const key = getKey(subDataElement.id, cocId);
                                    const dv = this.data.dataValues[key];
                                    return dv
                                        ? { dataElement: subDataElement, value: toFloat(dv.value) }
                                        : null;
                                });
                            })
                            .compact()
                            .value();

                        const subValuesSum = _.sum(subData.map(obj => obj.value));

                        const dataElementId = globalDataElement.dataElement.id;
                        assert(project.orgUnit);

                        const reason: ValidationItem["reason"] = {
                            id: [period, dataElementId, cocId].join("."),
                            project: { id: project.orgUnit.id },
                            dataElementId: dataElementId,
                            period: period,
                            cocId: cocId,
                        };

                        const cocName = cocIdsMapping[cocId]?.name;

                        if (subValuesSum >= 0 && !globalValue) {
                            const msg = i18n.t(
                                "Global indicator {{-name}} must have a value (as some sub-indicator has a value)",
                                { name: globalDataElement.name }
                            );
                            return [{ level: "error", message: msg, reason: reason }];
                        } else if (subValuesSum && globalValue > subValuesSum) {
                            const msg = i18n.t(
                                "Global indicator {{-name}} value ({{value}}) must be inferior to the sum of new+returning of its sub-indicators ({{subFormula}})",
                                {
                                    name: `${globalDataElement.name} (${cocName})`,
                                    value: globalValue,
                                    subFormula: `${subData
                                        .map(o => o.value)
                                        .join(" + ")} = ${subValuesSum}`,
                                    nsSeparator: false,
                                }
                            );
                            return [{ level: "error", message: msg, reason: reason }];
                        } else {
                            return [];
                        }
                    }
                );
            })
            .value();
    }

    validateAllGlobalsAreEqualOrGreaterThanMaxSub(): ValidationItem[] {
        const { period, globalDataElements } = this.data;

        return _(globalDataElements)
            .flatMap(globalDataElement => {
                return _.flatMap(globalDataElement.categoryOptionComboIds, cocId => {
                    const dataValue: DataValue = {
                        dataElementId: globalDataElement.id,
                        categoryOptionComboId: cocId,
                        period,
                        value: this.getValue(globalDataElement.id, cocId) || "",
                    };
                    return this.validateGlobalIsEqualOrGreaterThanMaxSub(dataValue);
                });
            })
            .value();
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
                "A sub-indicator should be equal to or less than its global indicator: {{-name}} ({{value}})",
                {
                    name: getDataElementName(globalDataElement),
                    value: globalValue,
                    nsSeparator: false,
                }
            );
            return [{ level: "error", message: msg }];
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
                "A global indicator should be equal to or greater than its maximum sub-indicator: {{-name}} ({{value}})",
                {
                    name: getDataElementName(maxSubItem.dataElement),
                    value: maxSubItem.value,
                    nsSeparator: false,
                }
            );
            return [{ level: "error", message: msg }];
        } else {
            return [];
        }
    }

    validateNonEmptyGlobalsWhenSubsHaveValues(): ValidationItem[] {
        const { config, globalDataElements } = this.data;

        return _(globalDataElements)
            .map((globalDataElement): ValidationItem | null => {
                const isValid = _(globalDataElement.categoryOptionComboIds).every(cocId => {
                    const globalValue = this.getValue(globalDataElement.id, cocId);
                    const globalIsEmpty = !globalValue;

                    if (!globalIsEmpty) {
                        return true;
                    } else {
                        const subDataElements = getSubs(config, globalDataElement.id);
                        const allSubsAreEmpty = _(subDataElements).every(subDataElement => {
                            const subValue = this.getValue(subDataElement.id, cocId);
                            return !subValue;
                        });
                        return allSubsAreEmpty;
                    }
                });

                const msg = i18n.t(
                    "Global indicator with sub-indicators values cannot be empty: {{- name}}",
                    {
                        name: globalDataElement.name,
                        nsSeparator: false,
                    }
                );

                return isValid ? null : { level: "error", message: msg };
            })
            .compact()
            .value();
    }

    private getValue(dataElementId: string, categoryOptionComboId: string): string | undefined {
        const key = getKey(dataElementId, categoryOptionComboId);
        const dataValue = this.data.dataValues[key];
        return dataValue?.value;
    }
}

function getCocIdsMapping(config: Config) {
    const cos = baseConfig.categoryOptions;
    const newMale = getCocId(config, [cos.new, cos.male]);
    const newFemale = getCocId(config, [cos.new, cos.female]);
    const returningMale = getCocId(config, [cos.recurring, cos.male]);
    const returningFemale = getCocId(config, [cos.recurring, cos.female]);

    const cocIdsMapping = {
        [newMale]: { name: "New/Male", subCocIds: [newMale, returningMale] },
        [newFemale]: { name: "New/Female", subCocIds: [newFemale, returningFemale] },
        [returningMale]: { name: "Returning/Male", subCocIds: [newMale, returningMale] },
        [returningFemale]: { name: "Returning/Female", subCocIds: [newFemale, returningFemale] },
    };

    return cocIdsMapping;
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

function getKey(dataElementId: string, categoryOptionComboId: string): DataValueId {
    return [dataElementId, categoryOptionComboId].join("-");
}

function getCocId(config: Config, codes: string[]): string {
    return (
        config.categoryCombos.genderNewRecurring.categoryOptionCombos.find(
            coc =>
                _(coc.categoryOptions)
                    .map(co => co.code)
                    .difference(codes)
                    .size() === 0
        )?.id || ""
    );
}

export class GlobalValidatorReport {
    constructor(private api: D2Api, private config: Config) {}

    async execute(options: { parentOrgUnitId?: Id }) {
        const { config } = this;
        const { dataElementGroups } = config.base;
        const degCodes = [dataElementGroups.global, dataElementGroups.sub];

        console.debug(`Get metadata`);
        const metadata = await this.api.metadata
            .get({
                organisationUnits: { fields: { id: true, level: true, name: true } },
                dataElementGroups: { fields: { id: true }, filter: { code: { in: degCodes } } },
                dataSets: {
                    fields: {
                        ...dataSetFields,
                        attributeValues: { attribute: { code: true }, value: true },
                    },
                },
            })
            .getData();

        const rootOrgUnitId =
            options.parentOrgUnitId || metadata.organisationUnits.find(ou => ou.level === 1)?.id;
        assert(rootOrgUnitId, "Org unit not found");

        const orgUnitsById = _.keyBy(metadata.organisationUnits, ou => ou.id);

        const format = "YYYY-MM";
        const startDate = moment().subtract(1, "year");
        const endDate = moment().add(1, "month");

        const getSetOptions: DataValueSetsGetRequest = {
            orgUnit: [rootOrgUnitId],
            dataSet: [],
            children: true,
            dataElementGroup: metadata.dataElementGroups.map(deg => deg.id),
            startDate: startDate.format(format),
            endDate: endDate.format(format),
        };

        console.debug(`Get data`);
        const { dataValues } = await this.api.dataValues.getSet(getSetOptions).getData();

        const dataSetsByOrgUnitId = _.keyBy(metadata.dataSets, dataSet => {
            return (
                dataSet.attributeValues.find(
                    av => av.attribute.code === config.base.attributes.orgUnitProject
                )?.value || ""
            );
        });

        const groups = _(dataValues)
            .groupBy(dv => [dv.orgUnit, dv.attributeOptionCombo, dv.period].join("."))
            .toPairs()
            .value();

        type Entry = {
            orgUnit: { id: Id; name: string };
            dataSetType: DataSetType;
            period: string;
            messages: string[];
        };

        const dataValuesById = _.keyBy(dataValues, dv => getDataValueId(dv));

        const entries = groups.map(([groupId, dataValuesForGroup]): Entry | undefined => {
            const [orgUnitId, aocId, period] = groupId.split(".");
            const dataSet = dataSetsByOrgUnitId[orgUnitId];
            const orgUnit = orgUnitsById[orgUnitId];

            if (!dataSet) {
                console.error(`Dataset not found for orgunitId=${orgUnitId}`);
                return undefined;
            } else if (!orgUnit) {
                console.error(`Org unit not found for orgunitId=${orgUnitId}`);
                return undefined;
            }

            console.debug(
                `Get validations for orgUnit=${orgUnitId}, dataSet=${dataSet.id}, period=${period}`
            );

            const validation = validateNonEmptyGlobalsWhenSubsHaveValues({
                config: config,
                dataValues: dataValuesForGroup,
                globalDataElements: GlobalValidator.getGlobalDataElements(config, dataSet),
                orgUnitId: orgUnitId,
                period: period,
                aocId: aocId,
            });

            const dataSetType: DataSetType = dataSet.code.includes(
                config.base.categoryOptions.target
            )
                ? "target"
                : "actual";

            if (validation.length === 0) return undefined;

            const messages = validation.map(item => {
                const reason = item.reason;
                const comment = reason
                    ? dataValuesById[
                          getDataValueId({
                              period: period,
                              orgUnit: orgUnitId,
                              attributeOptionCombo: aocId,
                              dataElement: reason.dataElementId,
                              categoryOptionCombo: reason.cocId,
                          })
                      ]?.comment
                    : undefined;

                const commentLines = comment?.split(/\n/) || [];
                const index = commentLines.findIndex(line => line === DataEntry.commentSeparator);
                const comment2 = index >= 0 ? commentLines.slice(0, index).join("\n") : "";

                return `${item.message}: ${comment2 || "-"}`;
            });

            const period2 = period.slice(0, 4) + "-" + period.slice(4, 6);

            return { orgUnit, dataSetType, period: period2, messages };
        });

        const lines = _(entries)
            .compact()
            .orderBy([e => e.orgUnit.name, e => e.period, e => e.dataSetType])
            .flatMap(entry => {
                return [
                    `${entry.orgUnit.name} - ${entry.dataSetType.toUpperCase()} - ${entry.period}:`,
                    ...entry.messages.map(message => `&nbsp;&nbsp;- ${message}`),
                ];
            })
            .value();

        fs.writeFileSync("output.txt", lines.join("\n") + "\n");

        console.debug(`Total report lines: ${lines.length}`);

        const recipients = await ProjectNotification.getRecipients(this.api);
        const chunks = _.chunk(lines, 25).map((chunk, index) => [chunk, index] as const);
        const debugRecipients = process.env["RECIPIENTS"];

        await promiseMap(chunks, ([linesGroup, chunkIdx]) => {
            const subject = `[SP Platform] Validations (${chunkIdx + 1}/${chunks.length})`;
            const mailRecipients = debugRecipients ? debugRecipients.split(",") : recipients;
            const body = linesGroup.join("\n") + "\n\n";
            console.debug(`Send message: ${subject} -> ${mailRecipients} (size: ${body.length})`);

            return this.api.email
                .sendMessage({ subject: subject, recipients: mailRecipients, text: body })
                .getData();
        });
    }
}

// TODO: Refactor to reuse code in GlobalValidator
function validateNonEmptyGlobalsWhenSubsHaveValues(options: {
    config: Config;
    dataValues: DataValueSetsDataValue[];
    globalDataElements: GlobalDataElement[];
    orgUnitId: string;
    period: string;
    aocId: string;
}): ValidationItem[] {
    const { config, globalDataElements, period } = options;
    const indexedDataValues = _.keyBy(options.dataValues, dv => getDataValueId(dv));
    const cocIdsMapping = getCocIdsMapping(options.config);

    return _(globalDataElements)
        .filter(de => de.dataElement.peopleOrBenefit === "people")
        .flatMap(globalDataElement => {
            return _.flatMap(
                globalDataElement.categoryOptionComboIds,
                (cocId): ValidationItem[] => {
                    const selector = {
                        orgUnit: options.orgUnitId,
                        period: options.period,
                        categoryOptionCombo: cocId,
                        attributeOptionCombo: options.aocId,
                    };
                    const globalDataValueId = getDataValueId({
                        ...selector,
                        dataElement: globalDataElement.id,
                    });
                    const strValue = indexedDataValues[globalDataValueId]?.value;
                    if (!strValue) return [];

                    const subDataElements = getSubs(config, globalDataElement.id);
                    const globalValue = toFloat(strValue);
                    const relatedCocIds = _.compact(cocIdsMapping[cocId]?.subCocIds || []);

                    const subData = _(subDataElements)
                        .flatMap(subDataElement => {
                            return relatedCocIds.map(cocId => {
                                const subDataValueId = getDataValueId({
                                    ...selector,
                                    categoryOptionCombo: cocId,
                                    dataElement: subDataElement.id,
                                });
                                const dv = indexedDataValues[subDataValueId];
                                return dv
                                    ? { dataElement: subDataElement, value: toFloat(dv.value) }
                                    : null;
                            });
                        })
                        .compact()
                        .value();

                    const subValuesSum = _.sum(subData.map(obj => obj.value));

                    const dataElementId = globalDataElement.dataElement.id;

                    const reason: ValidationItem["reason"] = {
                        id: [period, dataElementId, cocId].join("."),
                        project: { id: options.orgUnitId },
                        dataElementId: dataElementId,
                        period: period,
                        cocId: cocId,
                    };

                    const cocName = cocIdsMapping[cocId]?.name;

                    if (subValuesSum > 0 && !globalValue) {
                        const msg = i18n.t(
                            "Global indicator {{-name}} must have a value (as some sub-indicator has a value)",
                            { name: globalDataElement.name }
                        );
                        return [{ level: "error", message: msg, reason: reason }];
                    } else if (subValuesSum && globalValue > subValuesSum) {
                        const msg = i18n.t(
                            "Global indicator {{-name}} value ({{value}}) must be inferior to the sum of new+returning of its sub-indicators ({{subFormula}})",
                            {
                                name: `${globalDataElement.name} (${cocName})`,
                                value: globalValue,
                                subFormula: `${subData
                                    .map(o => o.value)
                                    .join(" + ")} = ${subValuesSum}`,
                                nsSeparator: false,
                            }
                        );
                        return [{ level: "error", message: msg, reason: reason }];
                    } else {
                        return [];
                    }
                }
            );
        })
        .value();
}

type Id = string;

type DataValueIdFields =
    | "orgUnit"
    | "period"
    | "dataElement"
    | "categoryOptionCombo"
    | "attributeOptionCombo";

function getDataValueId(dataValue: Pick<DataValueSetsDataValue, DataValueIdFields>): string {
    return [
        dataValue.orgUnit,
        dataValue.period,
        dataValue.dataElement,
        dataValue.categoryOptionCombo,
        dataValue.attributeOptionCombo,
    ].join(".");
}

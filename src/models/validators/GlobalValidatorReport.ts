import _ from "lodash";
import * as CsvWriter from "csv-writer";
import { DataSetType } from "../Project";
import i18n from "../../locales";
import { Config } from "../Config";
import { DataEntry } from "../DataEntry";
import { assert } from "../../scripts/common";
import moment, { Moment } from "moment";
import { dataSetFields } from "../ProjectDb";
import { ProjectNotification } from "../ProjectNotification";
import {
    Id,
    getDataValuesFromD2,
    getDataValueId,
    BasicData,
    getIndexedDataValues,
    GlobalValidator,
    GlobalPeopleSumGreaterThanSubsSumValidator,
} from "./GlobalValidator";
import { DataValue, getReasonCocId, ValidationResult } from "./validator-common";
import {
    D2Api,
    DataValueSetsDataValue,
    DataValueSetsGetRequest,
    MetadataPick,
} from "../../types/d2-api";
import { CancelableResponse } from "@eyeseetea/d2-api";
import { promiseMap } from "../../migrations/utils";

type Periods = { startDate: Moment };

const dataValuesFromDate = "2023-09-01";

type ValidationWithReason = {
    message: string;
    reason: string;
};

export class GlobalValidatorReport {
    format = "YYYY-MM-DD";

    constructor(private options: { api: D2Api; config: Config }) {}

    async execute(options: { parentOrgUnitId?: Id }) {
        const metadata = await this.getMetadata();
        const periods = this.getPeriods();
        const dataValues = await this.getDataValues({ ...options, metadata, periods });
        const entries = this.getEntries({ metadata, dataValues });
        const { documentUrl } = await this.uploadFile(entries, this.options.api);
        await this.sendMessage({ documentUrl, entries, periods });
    }

    private async getMetadata(): Promise<Metadata> {
        const { api, config } = this.options;
        const { dataElementGroups } = config.base;
        const degCodes = [
            dataElementGroups.global,
            dataElementGroups.sub,
            dataElementGroups.subreportable,
        ];

        console.debug(`Get metadata`);
        const metadata = await api.metadata.get(getMetadataQuery(degCodes)).getData();
        return metadata;
    }

    private getCommentCocId() {
        return getReasonCocId(this.options.config);
    }

    private getPeriods() {
        const startDate = moment(dataValuesFromDate);
        return { startDate: startDate };
    }

    private async getDataValues(options: {
        parentOrgUnitId?: Id;
        metadata: Metadata;
        periods: Periods;
    }): Promise<DataValueSetsDataValue[]> {
        const lastUpdatedDataValues = await this.getLastUpdatedDataValues(options);
        const groups = this.getDataValueGroups(lastUpdatedDataValues);
        console.debug(`Grouped requested to perform: ${groups.length}`);

        return _.flatten(
            await promiseMap(groups, group => {
                return this.getDataValuesForGroup(group, options.metadata);
            })
        );
    }

    private async getLastUpdatedDataValues(options: {
        parentOrgUnitId?: Id;
        metadata: Metadata;
        periods: Periods;
    }) {
        const { metadata, periods } = options;

        const rootOrgUnitId =
            options.parentOrgUnitId || metadata.organisationUnits.find(ou => ou.level === 1)?.id;
        assert(rootOrgUnitId, "Org unit not found");

        const lastUpdated = periods.startDate.format(this.format);

        const getSetOptions: DataValueSetsGetRequest = {
            orgUnit: [rootOrgUnitId],
            dataSet: [],
            children: true,
            dataElementGroup: metadata.dataElementGroups.map(deg => deg.id),
            lastUpdated: lastUpdated,
        };

        const { dataValues } = await this.options.api.dataValues.getSet(getSetOptions).getData();
        console.debug(`Get data values updated from: ${lastUpdated}: ${dataValues.length}`);

        return dataValues;
    }

    private async getDataValuesForGroup(
        group: { period: string; aocId: string; orgUnitIds: string[] },
        metadata: Metadata
    ): Promise<DataValueSetsDataValue[]> {
        console.debug(
            `Get data values: aoc=${group.aocId}, period=${
                group.period
            }, orgUnits=${group.orgUnitIds.join(", ")}`
        );

        return promiseMap(_.chunk(group.orgUnitIds, 100), async orgUnitIdsChunk => {
            const options: DataValueSetsGetRequest = {
                attributeOptionCombo: [group.aocId],
                period: [group.period],
                orgUnit: orgUnitIdsChunk,
                dataSet: [],
                dataElementGroup: metadata.dataElementGroups.map(deg => deg.id),
            };

            const { dataValues } = await this.options.api.dataValues.getSet(options).getData();

            return dataValues;
        }).then(_.flatten);
    }

    private getDataValueGroups(dataValues: DataValueSetsDataValue[]): Array<{
        period: string;
        aocId: string;
        orgUnitIds: string[];
    }> {
        return (
            _(dataValues)
                // Group by all except orgUnits to minimize requests
                .groupBy(dv => [dv.period, dv.attributeOptionCombo].join("."))
                .toPairs()
                .map(([key, dataValuesForGroup]) => {
                    const [period, attributeOptionCombo] = key.split(".");

                    return {
                        period,
                        aocId: attributeOptionCombo,
                        orgUnitIds: _(dataValuesForGroup)
                            .map(dv => dv.orgUnit)
                            .uniq()
                            .value(),
                    };
                })
                .value()
        );
    }

    private async sendMessage(options: {
        documentUrl: string;
        entries: Entry[];
        periods: Periods;
    }) {
        const { api } = this.options;
        const { entries, documentUrl, periods } = options;

        const projectNames = _(entries)
            .map(entry => entry.orgUnit.name)
            .uniq()
            .sortBy()
            .value();

        const body = [
            i18n.t("Validate changes from: {{periods}} ", {
                periods: periods.startDate.format(this.format),
                nsSeparator: false,
            }),
            "",
            documentUrl,
            "",
            i18n.t("Global data elements reported count: {{dataElementsCount}} ", {
                dataElementsCount: entries.length,
                nsSeparator: false,
            }),
            i18n.t("Projects with global validations reported ({{projectsCount}}): {{-projects}}", {
                projectsCount: projectNames.length,
                projects: "\n" + projectNames.map(name => `  - ${name}`).join("\n"),
                nsSeparator: false,
            }),
            "",
        ].join("\n");

        const recipients = await ProjectNotification.getRecipients(api);
        const debugRecipients = process.env["RECIPIENTS"];

        const subject = `[SP Platform] Validations`;
        const mailRecipients = _.compact(
            debugRecipients !== undefined ? debugRecipients.split(",") : recipients
        );

        if (!_.isEmpty(mailRecipients)) {
            console.debug(`Send message: ${subject} -> ${mailRecipients}`);

            return api.email
                .sendMessage({ subject: subject, recipients: mailRecipients, text: body })
                .getData();
        }
    }

    private async uploadFile(entries: Entry[], api: D2Api): Promise<{ documentUrl: string }> {
        const info = await api.system.info.getData();
        const data = this.getCsvContents({ entries: entries });
        const timestamp = new Date().getTime();
        const uploadResult = await runApi(
            api.files.upload({
                name: `global-validator-${timestamp}.csv`,
                data: data,
            })
        );

        return {
            documentUrl: `${info.contextPath}/api/documents/${uploadResult.id}/data`,
        };
    }

    private getDataSetType(aocId: string): DataSetType | undefined {
        const { categoryOptions } = this.options.config;

        return _([
            ["target", categoryOptions.target] as const,
            ["actual", categoryOptions.actual] as const,
        ])
            .map(([dataSetType, categoryOption]) => {
                return _(categoryOption.categoryOptionCombos).some(coc => coc.id === aocId)
                    ? dataSetType
                    : null;
            })
            .compact()
            .first();
    }

    private getEntries(options: {
        metadata: Metadata;
        dataValues: DataValueSetsDataValue[];
    }): Entry[] {
        const { metadata, dataValues } = options;
        const { config } = this.options;
        const orgUnitsById = _.keyBy(metadata.organisationUnits, ou => ou.id);

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

        const dataValuesById = _.keyBy(getDataValuesFromD2(dataValues), dv => getDataValueId(dv));

        return _(groups)
            .flatMap(([groupId, dataValuesForGroup]): Entry[] => {
                const [orgUnitId, aocId, period] = groupId.split(".");
                const dataSet = dataSetsByOrgUnitId[orgUnitId];
                const orgUnit = orgUnitsById[orgUnitId];
                const dataSetType = this.getDataSetType(aocId);

                if (!dataSetType) {
                    console.error(`Cannot determine data set type for aocId=${aocId}`);
                    return [];
                } else if (!dataSet) {
                    console.error(`Dataset not found for orgUnitId=${orgUnitId}`);
                    return [];
                } else if (!orgUnit) {
                    console.error(`Org unit not found for orgUnitId=${orgUnitId}`);
                    return [];
                }

                const data: BasicData = {
                    config: config,
                    dataValues: getIndexedDataValues(getDataValuesFromD2(dataValuesForGroup)),
                    globalDataElements: GlobalValidator.getGlobalDataElements(config, dataSet),
                    orgUnitId: orgUnitId,
                    period: period,
                    attributeOptionComboId: aocId,
                };

                console.debug(`Get validations ${orgUnitId}/${dataSet.id}/${period}`);
                const validation = new GlobalPeopleSumGreaterThanSubsSumValidator(data).execute();
                if (validation.length === 0) return [];

                const opts = { validation, dataValuesById, period, orgUnitId, aocId };
                const validations = this.getMessagesFromValidation(opts);

                const periodHuman = period.slice(0, 4) + "-" + period.slice(4, 6);

                return validations.map(validation => {
                    return { orgUnit, dataSetType, period: periodHuman, validation: validation };
                });
            })
            .compact()
            .value();
    }

    private getMessagesFromValidation(options: {
        validation: ValidationResult;
        dataValuesById: _.Dictionary<DataValue>;
        period: string;
        orgUnitId: string;
        aocId: string;
    }): Array<ValidationWithReason> {
        const { validation, dataValuesById, period, orgUnitId, aocId } = options;

        return validation.map((item): ValidationWithReason => {
            const reason = item.reason;
            const comment = reason
                ? dataValuesById[
                      getDataValueId({
                          period: period,
                          orgUnitId: orgUnitId,
                          attributeOptionComboId: aocId,
                          dataElementId: reason.dataElementId,
                          categoryOptionComboId: this.getCommentCocId(),
                      })
                  ]?.comment
                : undefined;

            const commentLines = comment?.split(/\n/) || [];
            const index = commentLines.findIndex(line => line === DataEntry.commentSeparator);
            const reasonStr = index >= 0 ? commentLines.slice(0, index).join("\n") : "";

            return { message: item.message, reason: reasonStr };
        });
    }

    private getCsvContents(options: { entries: Entry[] }): Buffer {
        type Row = {
            project: string;
            type: string;
            period: string;
            validation: string;
            reason: string;
        };

        const headers: Record<keyof Row, { title: string }> = {
            project: { title: "Project" },
            type: { title: "Type" },
            period: { title: "Period" },
            validation: { title: "Validation" },
            reason: { title: "Reason" },
        };

        const formatObj = (obj: { id: string; name: string }) => `${obj.name.trim()} [${obj.id}]`;

        const records = options.entries.map((entry): Row => {
            return {
                project: formatObj(entry.orgUnit),
                type: entry.dataSetType,
                period: entry.period,
                validation: entry.validation.message,
                reason: entry.validation.reason,
            };
        });

        const csvHeader = _.map(headers, (obj, key) => ({ id: key, ...obj }));
        const csvWriter = CsvWriter.createObjectCsvStringifier({ header: csvHeader });
        const header = csvWriter.getHeaderString();
        const rows = csvWriter.stringifyRecords(records);
        const contents = [header, rows].join("\n") + "\n";
        return Buffer.from(contents, "utf8");
    }
}

type Entry = {
    orgUnit: { id: Id; name: string };
    dataSetType: DataSetType;
    period: string;
    validation: { message: string; reason: string };
};

function getMetadataQuery(degCodes: string[]) {
    return {
        organisationUnits: { fields: { id: true, level: true, name: true } },
        dataElementGroups: { fields: { id: true }, filter: { code: { in: degCodes } } },
        dataSets: {
            fields: {
                ...dataSetFields,
                attributeValues: { attribute: { code: true }, value: true },
            },
        },
    } as const;
}

type Metadata = MetadataPick<ReturnType<typeof getMetadataQuery>>;

async function runApi<T>(res: CancelableResponse<T>): Promise<T> {
    try {
        return await res.getData();
    } catch (err: any) {
        console.error(err);
        throw new Error(err);
    }
}

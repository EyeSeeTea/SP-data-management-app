import {
    D2Api,
    DataValueSetsDataValue,
    DataValueSetsGetRequest,
    MetadataPick,
} from "../../types/d2-api";
import _ from "lodash";
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
    GlobalSubsValidator,
} from "./GlobalValidator";
import { getReasonCocId } from "./validator-common";

type Periods = { startDate: Moment; endDate: Moment };

export class GlobalValidatorReport {
    format = "YYYY-MM";

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
        const degCodes = [dataElementGroups.global, dataElementGroups.sub];

        console.debug(`Get metadata`);
        const metadata = await api.metadata.get(getMetadataQuery(degCodes)).getData();
        return metadata;
    }

    private getCommentCocId() {
        return getReasonCocId(this.options.config);
    }

    private getPeriods() {
        const now = moment();
        const startDate = now.clone().subtract(1, "month");
        const endDate = now.clone();
        return { startDate: startDate, endDate: endDate };
    }

    private async getDataValues(options: {
        parentOrgUnitId?: Id;
        metadata: Metadata;
        periods: Periods;
    }) {
        const { metadata, periods } = options;
        const rootOrgUnitId =
            options.parentOrgUnitId || metadata.organisationUnits.find(ou => ou.level === 1)?.id;
        assert(rootOrgUnitId, "Org unit not found");

        const getSetOptions: DataValueSetsGetRequest = {
            orgUnit: [rootOrgUnitId],
            dataSet: [],
            children: true,
            dataElementGroup: metadata.dataElementGroups.map(deg => deg.id),
            startDate: periods.startDate.format(this.format),
            endDate: periods.endDate.clone().add(1, "month").format(this.format),
        };

        console.debug(`Get data`);
        const { dataValues } = await this.options.api.dataValues.getSet(getSetOptions).getData();
        return dataValues;
    }

    private async sendMessage(options: {
        documentUrl: string;
        entries: Entry[];
        periods: Periods;
    }) {
        const { api } = this.options;
        const { entries, documentUrl, periods } = options;
        const periodsStr = [
            periods.startDate.format(this.format),
            "->",
            periods.endDate.format(this.format),
        ].join(" ");

        const projectNames = _(entries)
            .map(entry => entry.orgUnit.name)
            .uniq()
            .sortBy()
            .value();

        const body = [
            i18n.t("Periods considered: {{periods}} ", {
                periods: periodsStr,
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

    private async uploadFile(
        entries: (Entry | undefined)[],
        api: D2Api
    ): Promise<{ documentUrl: string }> {
        const lines = _(entries)
            .compact()
            .orderBy([e => e.orgUnit.name, e => e.period, e => e.dataSetType])
            .map((entry, index) => {
                return [
                    `${(index + 1).toString()}. ${
                        entry.orgUnit.name
                    } - ${entry.dataSetType.toUpperCase()} - ${entry.period}:`,
                    ...entry.messages.map(message => `  - ${message}`),
                ].join("\n");
            })
            .value();

        const contents = lines.join("\n\n") + "\n";
        const timestamp = new Date().getTime();

        const data = Buffer.from(contents, "utf8");
        const uploadResult = await api.files
            .upload({
                name: `global-validator-${timestamp}.txt`,
                data: data,
            })
            .getData()
            .catch(err => {
                console.error(err);
                throw new Error(err);
            });

        const info = await api.system.info.getData();

        return {
            documentUrl: `${info.contextPath}/api/documents/${uploadResult.id}/data`,
        };
    }

    private getDataSetType(aocId: string) {
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

    private getEntries(options: { metadata: Metadata; dataValues: DataValueSetsDataValue[] }) {
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
            .map(([groupId, dataValuesForGroup]): Entry | undefined => {
                const [orgUnitId, aocId, period] = groupId.split(".");
                const dataSet = dataSetsByOrgUnitId[orgUnitId];
                const orgUnit = orgUnitsById[orgUnitId];

                if (!dataSet) {
                    console.error(`Dataset not found for orgUnitId=${orgUnitId}`);
                    return undefined;
                } else if (!orgUnit) {
                    console.error(`Org unit not found for orgUnitId=${orgUnitId}`);
                    return undefined;
                }

                console.debug(
                    `Get validations for orgUnit=${orgUnitId}, dataSet=${dataSet.id}, period=${period}`
                );

                const data: BasicData = {
                    config: config,
                    dataValues: getIndexedDataValues(getDataValuesFromD2(dataValuesForGroup)),
                    globalDataElements: GlobalValidator.getGlobalDataElements(config, dataSet),
                    orgUnitId: orgUnitId,
                    period: period,
                    attributeOptionComboId: aocId,
                };

                const validation = new GlobalSubsValidator(data).execute();
                const dataSetType = this.getDataSetType(aocId);

                if (!dataSetType) {
                    console.error(
                        `Cannot determine data set type for attributeOptionCombo: ${aocId}`
                    );
                    return undefined;
                }

                if (validation.length === 0) return undefined;

                const messages = validation.map(item => {
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
                    const index = commentLines.findIndex(
                        line => line === DataEntry.commentSeparator
                    );
                    const reasonStr = index >= 0 ? commentLines.slice(0, index).join("\n") : "";

                    const parts = [
                        item.message,
                        reasonStr
                            ? i18n.t("Reason: {{reasonStr}}", { reasonStr, nsSeparator: false })
                            : null,
                    ];

                    return _(parts).compact().join(" - ");
                });

                const period2 = period.slice(0, 4) + "-" + period.slice(4, 6);

                return { orgUnit, dataSetType, period: period2, messages };
            })
            .compact()
            .value();
    }
}

type Entry = {
    orgUnit: { id: Id; name: string };
    dataSetType: DataSetType;
    period: string;
    messages: string[];
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

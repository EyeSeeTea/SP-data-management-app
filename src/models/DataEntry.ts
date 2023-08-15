import _ from "lodash";
import moment from "moment";
import Project, { DataSetType } from "./Project";
import i18n from "../locales";
import {
    D2Api,
    DataValueSetsDataValue,
    DataValueSetsGetRequest,
    DataValueSetsPostRequest,
} from "../types/d2-api";
import { promiseMap } from "../migrations/utils";
import { ReasonId, Reasons, ValidationItem, ValidationResult } from "./validators/validator-common";
import { Config } from "./Config";
import { fromPairs, Maybe } from "../types/utils";

export class DataEntry {
    commentSeparator = "---";

    constructor(
        private api: D2Api,
        private project: Project,
        private dataSetType: "actual" | "target",
        private period: string
    ) {}

    async getReasons(validation: ValidationResult): Promise<Reasons> {
        const existingDataValues = await this.getExistingDataValues(validation);
        return this.getReasonsFromExistingDataValues(existingDataValues, validation);
    }

    async saveReasons(reasons: Reasons, validation: ValidationItem[]): Promise<void> {
        const existingDataValues = await this.getExistingDataValues(validation);
        const dataSetId = this.project.dataSetsByType[this.dataSetType].dataSet?.id;
        if (!dataSetId) return Promise.reject("No data set");

        const request: DataValueSetsPostRequest = {
            dataSet: dataSetId,
            dataValues: _(validation)
                .map((item): Maybe<DataValue> => {
                    return this.mergeDataValues(item, reasons, existingDataValues);
                })
                .compact()
                .value(),
        };

        const response = await this.api.dataValues.postSet({}, request).getData();

        if (response.status !== "SUCCESS") return Promise.reject(`Error on save`);
    }

    private mergeDataValues(
        item: ValidationItem,
        reasons: Reasons,
        existingDataValues: DataValue[]
    ): Maybe<DataValue> {
        if (!item.reason) return undefined;
        const reason = item.reason;

        const reasonText = reasons[reason.id];
        const comment = [reasonText, this.commentSeparator, item.message].join("\n");

        const dataValue = {
            orgUnit: this.project.orgUnit?.id,
            dataElement: reason.dataElementId,
            categoryOptionCombo: reason.cocId,
            attributeOptionCombo: this.getAocId(),
            period: reason.period,
            comment: comment,
        };

        const equalityFields = [
            "dataElement",
            "orgUnit",
            "period",
            "categoryOptionCombo",
            "attributeOptionCombo",
        ];
        const dataValue1 = _.pick(dataValue, equalityFields);

        const existingDataValue = existingDataValues.find(dv => {
            return _.isEqual(dataValue1, _.pick(dv, equalityFields));
        });

        return { ...dataValue, value: existingDataValue?.value || "" };
    }

    private getAocId() {
        return getAttributeOptionCombo(this.project.config, this.dataSetType);
    }

    async getEntryUsers(): Promise<User[]> {
        const { api, project, dataSetType, period } = this;
        const { config } = project;
        if (!project.orgUnit || !project.dataSets) return [];

        const dataSet = project.dataSets[dataSetType];
        const aocIds = config.categoryOptions[dataSetType].categoryOptionCombos.map(coc => coc.id);
        const getSetOptions: DataValueSetsGetRequest = {
            orgUnit: [project.orgUnit.id],
            dataSet: [dataSet.id],
            period: [period],
            attributeOptionCombo: aocIds,
        };
        const dataValuesRes = await api.dataValues.getSet(getSetOptions).getData();
        const usernames = _.uniq(dataValuesRes.dataValues.map(dv => dv.storedBy));

        const queryResponses = await promiseMap(usernames, username =>
            api.userLookup.query(username).getData()
        );

        return _(queryResponses)
            .flatMap(res => res.users)
            .filter(user => usernames.includes(user.username))
            .map(user => ({ id: user.id, name: user.displayName, username: user.username }))
            .value();
    }

    async sendMessage(users: User[], body: string) {
        const { api, project, dataSetType, period } = this;
        if (!project.dataSets) throw new Error("No dataset found");
        const periodName = moment(period, "YYYYMM").format("MMMM YYYY");
        const subject = [i18n.t("Data Approval"), project.name, dataSetType, periodName].join(
            " - "
        );

        return api.messageConversations
            .post({
                subject,
                text: body,
                users: users.map(user => ({ id: user.id })),
            })
            .getData();
    }

    private async getExistingDataValues(
        result: ValidationResult
    ): Promise<DataValueSetsDataValue[]> {
        const dataSet = this.project.dataSetsByType[this.dataSetType].dataSet;
        const aocId = getAttributeOptionCombo(this.project.config, this.dataSetType);
        const reasonsList = _(result)
            .map(item => item.reason)
            .compact()
            .value();

        const orgUnitIds = _.uniq(_.compact(reasonsList.map(o => o.project.orgUnit?.id)));
        const dataSetIds = _.compact([dataSet?.id]);

        if (!(orgUnitIds.length && dataSetIds.length)) return [];

        const { dataValues: existingDataValues } = await this.api.dataValues
            .getSet({
                orgUnit: orgUnitIds,
                dataSet: dataSetIds,
                period: [this.period],
                attributeOptionCombo: [aocId],
            })
            .getData();

        return existingDataValues;
    }

    private getReasonsFromExistingDataValues(
        existingDataValues: DataValueSetsDataValue[],
        validation: ValidationResult
    ): Reasons | PromiseLike<Reasons> {
        return fromPairs(
            _(existingDataValues)
                .map((dv): [ReasonId, string] | null => {
                    const justifyId = [dv.period, dv.dataElement, dv.categoryOptionCombo].join(".");
                    const lines = (dv.comment || "").split("\n");
                    const index = lines.findIndex(line => line === this.commentSeparator);
                    const comment = lines.slice(0, index).join("\n");
                    const formula = lines.slice(index + 1).join("\n");
                    const matchingItem = validation.find(item => item.reason?.id === justifyId);
                    const isUpToDate = matchingItem && formula === matchingItem.message;

                    return matchingItem && !isUpToDate ? [justifyId, comment] : null;
                })
                .compact()
                .value()
        );
    }
}

interface User {
    name: string;
    username: string;
    id: string;
}

function getAttributeOptionCombo(config: Config, dataSetType: DataSetType) {
    const categoryOption = config.categoryOptions[dataSetType];
    const aoc = categoryOption.categoryOptionCombos[0];
    if (!aoc) throw new Error("Cannot get attribute option combo");
    return aoc.id;
}

type DataValue = DataValueSetsPostRequest["dataValues"][number];

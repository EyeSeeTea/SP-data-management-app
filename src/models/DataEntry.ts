import _ from "lodash";
import moment from "moment";
import { DataSetType, ProjectBasic } from "./Project";
import i18n from "../locales";
import {
    D2Api,
    DataValueSetsDataValue,
    DataValueSetsGetRequest,
    DataValueSetsPostRequest,
} from "../types/d2-api";
import { promiseMap } from "../migrations/utils";
import {
    getReasonCocId,
    getReasonId,
    Reason,
    ReasonId,
    Reasons,
    ReasonsState,
    ValidationItem,
    ValidationResult,
} from "./validators/validator-common";
import { Config } from "./Config";
import { fromPairs } from "../types/utils";

export class DataEntry {
    static commentSeparator = "---";

    constructor(
        private api: D2Api,
        private project: ProjectBasic,
        private dataSetType: "actual" | "target",
        private period: string
    ) {}

    async getReasons(validation: ValidationResult): Promise<ReasonsState> {
        const existingDataValues = await this.getExistingDataValues(validation);
        return this.getReasonsFromExistingDataValues(existingDataValues, validation);
    }

    async getReasonsText(validation: ValidationResult): Promise<Reasons> {
        const reasons = await this.getReasons(validation);
        return _.mapValues(reasons, reason => reason.text);
    }

    async saveReasons(reasons: Reasons, validation: ValidationItem[]): Promise<void> {
        const existingDataValues = await this.getExistingDataValues(validation);
        const dataSetId = this.project.dataSetsByType[this.dataSetType].dataSet?.id;
        if (!dataSetId) return Promise.reject("No data set");

        return promiseMap(validation, item => {
            return this.postDataValue(item, reasons, existingDataValues);
        }).then(() => undefined);
    }

    private async postDataValue(
        item: ValidationItem,
        reasons: Reasons,
        _existingDataValues: DataValue[]
    ): Promise<void> {
        if (!item.reason) return undefined;
        const reason = item.reason;

        const reasonText = reasons[reason.id];
        const comment = [reasonText, DataEntry.commentSeparator, item.message].join("\n");

        return this.api
            .post("/dataValues", {
                de: reason.dataElementId,
                co: getReasonCocId(this.project.config),
                ds: this.project.dataSetsByType[this.dataSetType].dataSet?.id,
                ou: this.project.orgUnit?.id,
                pe: reason.period,
                comment: comment,
                cc: this.project.config.categoryCombos.targetActual.id,
                cp: this.project.config.categoryOptions[this.dataSetType].id,
            })
            .getData()
            .then(() => undefined);
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
        const config = this.project.config;
        const dataSet = this.project.dataSetsByType[this.dataSetType].dataSet;
        const aocId = getAttributeOptionCombo(this.project.config, this.dataSetType);
        const reasonsList = _(result)
            .map(item => item.reason)
            .compact()
            .value();

        const orgUnitIds = _.uniq(reasonsList.map(o => o.project.id));
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

        const reasonCocId = getReasonCocId(config);
        return existingDataValues.filter(dv => dv.categoryOptionCombo === reasonCocId);
    }

    private getReasonsFromExistingDataValues(
        existingDataValues: DataValueSetsDataValue[],
        validation: ValidationResult
    ): ReasonsState {
        return fromPairs(
            _(existingDataValues)
                .map((dv): [ReasonId, Reason] | null => {
                    const reasonId = getReasonId({
                        period: dv.period,
                        dataElementId: dv.dataElement,
                    });
                    const lines = (dv.comment || "").split("\n");
                    const index = lines.findIndex(line => line === DataEntry.commentSeparator);
                    const comment = lines.slice(0, index).join("\n");
                    const formula = lines.slice(index + 1).join("\n");
                    const matchingItem = validation.find(item => item.reason?.id === reasonId);
                    const upToDate = matchingItem ? formula === matchingItem.message : false;

                    return matchingItem ? [reasonId, { text: comment, upToDate }] : null;
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

import _ from "lodash";
import moment from "moment";
import Project from "./Project";
import i18n from "../locales";
import { D2Api, DataValueSetsGetRequest } from "../types/d2-api";
import { promiseMap } from "../migrations/utils";

export class DataEntry {
    constructor(
        private api: D2Api,
        private project: Project,
        private dataSetType: "actual" | "target",
        private period: string
    ) {}

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
}

interface User {
    name: string;
    username: string;
    id: string;
}

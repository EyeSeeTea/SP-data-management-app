import _ from "lodash";
import striptags from "striptags";
import ReactDOMServer from "react-dom/server";

import Project, { DataSetType } from "./Project";
import { ReactElement } from "react";
import i18n from "../locales";
import User from "./user";
import { generateUrl } from "../router";
import { D2Api } from "../types/d2-api";
import ProjectDb, { ExistingData, getStringDataValue } from "./ProjectDb";
import { baseConfig } from "./Config";
import moment from "moment";
import { AppConfig } from "../components/app/AppConfig";

type Email = string;
type Action = "create" | "update";

export class ProjectNotification {
    constructor(
        private api: D2Api,
        private appConfig: AppConfig,
        private project: Project,
        private currentUser: User,
        private isTest: boolean
    ) {}

    private async getRecipients() {
        const groupCode = "DATA_MANAGEMENT_NOTIFICATION";
        const { users: usersInGroup } = await this.api.metadata
            .get({
                users: {
                    fields: { email: true, userCredentials: { disabled: true } },
                    filter: { "userGroups.code": { eq: groupCode } },
                },
            })
            .getData();

        const users = _(usersInGroup)
            .reject(user => user.userCredentials.disabled)
            .value();

        return _(this.appConfig.app.notifyEmailOnProjectSave)
            .concat(users.map(user => user.email))
            .compact()
            .uniq()
            .value();
    }

    async notifyOnProjectSave(element: ReactElement, action: Action) {
        const recipients = await this.getRecipients();
        await this.notifySave(element, recipients, action);
        await this.notifyDanglingDataValues(recipients);
    }

    async notifyForDataReview(
        period: string,
        id: string,
        dataSetType: DataSetType
    ): Promise<boolean> {
        const { project } = this;
        const res = await this.api.metadata
            .get({
                userRoles: {
                    fields: {
                        id: true,
                        users: {
                            email: true,
                            id: true,
                            userCredentials: { disabled: true },
                            userGroups: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    filter: { name: { in: baseConfig.userRoles.dataReviewer } },
                },
                dataSets: {
                    fields: {
                        id: true,
                        userGroupAccesses: {
                            id: true,
                            displayName: true,
                        },
                        userAccesses: { id: true },
                    },
                    filter: { id: { in: [id] } },
                },
            })
            .getData();

        const { displayName: user, username } = this.currentUser.data;

        const subject = i18n.t("[SP Platform] Request for Data Review: {{name}} ({{code}})", {
            name: project.name,
            code: project.code,
            nsSeparator: false,
        });

        const year = period.slice(0, 4);
        const month = moment.months(Number(period.slice(4)) - 1);

        const projectId = this.project.id;
        const path = generateUrl("dataApproval", { id: projectId, dataSetType, period });
        const dataApprovalLink = getFullUrl(path);
        const dataSet = res.dataSets[0];

        const users = _(res.userRoles)
            .flatMap(userRole => userRole.users)
            .reject(user => user.userCredentials.disabled)
            .value();

        const userAccessEmails = users
            .filter(user => {
                return dataSet.userAccesses.some(userAccess => {
                    return userAccess.id === user.id;
                });
            })
            .map(user => user.email);

        const userGroupEmails = users
            .filter(user => {
                return dataSet.userGroupAccesses
                    .filter(ug => ug.displayName.includes("Country Admin"))
                    .some(userGroupAccess => {
                        return user.userGroups.some(userGroup => {
                            return userGroupAccess.id === userGroup.id;
                        });
                    });
            })
            .map(user => user.email);

        const recipients = _.union(userAccessEmails, userGroupEmails);

        const text = i18n.t(
            `
User {{user}} ({{username}}) is requesting data approval.

Project: [{{projectCode}}] {{projectName}}.

Dataset: {{dataSetType}} values for {{month}} {{year}}

Go to approval screen: {{- projectUrl}}`,
            {
                user,
                username,
                projectName: this.project.name,
                projectCode: this.project.code,
                dataSetType,
                projectUrl: dataApprovalLink,
                month,
                year,
                nsSeparator: false,
            }
        );

        return this.sendMessage({ recipients, subject, text: text.trim() });
    }

    async sendMessageForIndicatorsRemoval(options: {
        currentUser: User;
        message: string;
        existingData: ExistingData;
    }) {
        const { currentUser, message, existingData } = options;
        const { displayName: user, username } = currentUser.data;
        const recipients = await this.getRecipients();
        const subject = i18n.t("{{username}} has removed indicators with data", { username });

        const dataElementsList = existingData.dataElementsWithData
            .map(de => `- [${de.sector.name}] [${de.code}] ${de.name}`)
            .join("\n");

        const text = i18n.t(
            `
User {{user}} ({{username}}) has edited a project and removed some indicators with existing data.

Project: [{{projectCode}}] {{projectName}}

Removed indicators:

{{dataElementsList}}

The reason provided by the user was:

{{message}}`,
            {
                user,
                username,
                projectName: this.project.name,
                projectCode: this.project.code,
                dataElementsList,
                message,
                nsSeparator: false,
            }
        );

        return this.sendMessage({ recipients, subject, text: text.trim() });
    }

    private async notifySave(element: ReactElement, recipients: Email[], action: Action) {
        const { project, currentUser } = this;
        const baseMsg = action === "create" ? i18n.t("Project created") : i18n.t("Project updated");
        const subject = `${baseMsg}: ${this.project.name}`;

        const body = [
            i18n.t("Project '{{projectName}}' was {{action}} by {{user}} ({{username}})", {
                projectName: project.name,
                action: action === "create" ? i18n.t("created") : i18n.t("updated"),
                user: currentUser.data.displayName,
                username: currentUser.data.username,
            }),

            // Cypress fails when body includes an URL,
            !this.isTest ? getProjectUrl(project) : "test-url",
            html2Text(element),
        ];

        const text = body.join("\n\n");
        return this.sendMessage({ recipients, subject, text });
    }

    private async notifyDanglingDataValues(recipients: Email[]) {
        const { project } = this;
        const dataValues = await new ProjectDb(project).getDanglingDataValues();
        const projectName = project.name;

        if (_.isEmpty(dataValues)) return;

        const subject = i18n.t("Project '{{projectName}}' [dangling data values]", { projectName });

        const text =
            i18n.t("Project '{{projectName}}' has dangling data values:", { projectName }) +
            "\n\n" +
            dataValues.map(getStringDataValue).join("\n");

        return this.sendMessage({ recipients, subject, text });
    }

    private async sendMessage(options: {
        recipients: string[];
        subject: string;
        text: string;
    }): Promise<boolean> {
        const { api } = this;
        console.debug(`sendMessage: recipients=${options.recipients.join(", ")}`);
        const devRecipients = localStorage.getItem("recipients");
        const recipients =
            devRecipients !== null ? _.compact(devRecipients.split(",")) : options.recipients;

        if (_.isEmpty(recipients)) return false;

        try {
            await api.email.sendMessage({ ...options, recipients }).getData();
            return true;
        } catch (err) {
            // If the message could not be sent, just log to the console and continue the process.
            console.error(err);
            return true;
        }
    }
}

const nbsp = /\xa0/g;

function html2Text(element: ReactElement): string {
    const html = ReactDOMServer.renderToStaticMarkup(element);
    const text = striptags(html, [], "\n");
    const textWithoutBlankLines = text.replace(/^\s*$(?:\r\n?|\n)/gm, "").replace(nbsp, " ");
    return textWithoutBlankLines;
}

function getProjectUrl(project: Project) {
    const path = generateUrl("projects", undefined, { search: project.code });
    return getFullUrl(path);
}

function getFullUrl(path: string): string {
    return window.location.href.split("#")[0] + "#" + path;
}

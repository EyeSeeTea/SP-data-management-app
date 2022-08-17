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

type Email = string;
type Action = "create" | "update";

export class ProjectNotification {
    constructor(
        private api: D2Api,
        private project: Project,
        private currentUser: User,
        private isTest: boolean
    ) {}

    async notifyOnProjectSave(element: ReactElement, recipients: Email[], action: Action) {
        await this.notifySave(element, recipients, action);
        await this.notifyDanglingDataValues(recipients);
    }

    async notifyForDataReview(period: string, id: string, dataSetType: DataSetType) {
        const res = await this.api.metadata
            .get({
                userRoles: {
                    fields: {
                        id: true,
                        users: {
                            email: true,
                            id: true,
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
                        userGroupAccesses: true,
                        userAccesses: { id: true },
                    },
                    filter: { id: { in: [id] } },
                },
            })
            .getData();

        const { displayName: user, username } = this.currentUser.data;
        const subject = i18n.t("{{username}} is requesting a data review", { username });
        const users = res.userRoles.flatMap(userRole => userRole.users);
        const dataSet = res.dataSets[0];

        const userAccessEmails = users
            .filter(user => {
                return dataSet.userAccesses.some(userAccess => {
                    return userAccess.id === user.id;
                });
            })
            .map(user => user.email);

        const userGroupEmails = users
            .filter(user => {
                return dataSet.userGroupAccesses.some(userGroupAccess => {
                    return user.userGroups.some(userGroup => {
                        return userGroupAccess.id === userGroup.id;
                    });
                });
            })
            .map(user => user.email);

        const recipients = _.union(userAccessEmails, userGroupEmails);

        const text = i18n.t(
            `
User {{user}} ({{username}}) is requesting a data Review.

Project: [{{projectCode}}] {{projectName}}.

Dataset Type: {{dataSetType}}

Period: {{period}}`,
            {
                user,
                username,
                projectName: this.project.name,
                projectCode: this.project.code,
                dataSetType,
                period,
                nsSeparator: false,
            }
        );

        await this.sendMessage({ recipients, subject, text: text.trim() });
    }

    async sendMessageForIndicatorsRemoval(options: {
        recipients: Email[];
        currentUser: User;
        message: string;
        existingData: ExistingData;
    }) {
        const { recipients, currentUser, message, existingData } = options;
        const { displayName: user, username } = currentUser.data;
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

        await this.sendMessage({ recipients, subject, text: text.trim() });
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
            !this.isTest ? getUrl(project) : "test-url",
            html2Text(element),
        ];

        const text = body.join("\n\n");
        await this.sendMessage({ recipients, subject, text });
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

        await this.sendMessage({ recipients, subject, text });
    }

    private async sendMessage(options: {
        recipients: string[];
        subject: string;
        text: string;
    }): Promise<void> {
        const { api } = this;
        const recipients = localStorage.getItem("recipients")?.split(",") || options.recipients;

        try {
            await api.email.sendMessage({ ...options, recipients }).getData();
        } catch (err) {
            // If the message could not be sent, just log to the console and continue the process.
            console.error(err);
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

function getUrl(project: Project) {
    const path = generateUrl("projects", undefined, { search: project.code });
    return window.location.href.split("#")[0] + "#" + path;
}

import _ from "lodash";
import striptags from "striptags";
import ReactDOMServer from "react-dom/server";

import Project from "./Project";
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

    async notifyOnDataReady(period: string, id: string) {
        const res = await this.api.metadata
            .get({
                userRoles: {
                    fields: {
                        id: true,
                        users: {
                            email: true,
                            id: true,
                            name: true,
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

        const subject = i18n.t("{{username}} is requesting for data review", { username });
        const pageLink = window.location.href;
        const dataSetType = pageLink.includes("actual") ? "ACTUAL" : "TARGET";
        const filteredRecipients = res.userRoles[0].users.filter(user => {
            return res.dataSets[0].userAccesses.some(userAccess => {
                return userAccess.id === user.id;
            });
        });
        const recipients = filteredRecipients.map(user => user.email);

        const text = i18n.t(
            `
User {{user}} ({{username}}) is requesting Data Review.

Project: [{{projectCode}}] {{projectName}}.

Dataset Type: {{dataSetType}}

Period: {{period}}

The reason provided by the user was:

{{message}}`,
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

        const filtered2 = res.userRoles[0].users.map(user => {
            const a = user.userGroups.filter(userGroup => {
                return res.dataSets[0].userGroupAccesses.some(userGroupAccess => {
                    return userGroupAccess.id === userGroup.id;
                });
            });
            return a;
        });

        console.log(res.userRoles);
        console.log(res.dataSets);
        console.log(recipients);
        console.log(filtered2);

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

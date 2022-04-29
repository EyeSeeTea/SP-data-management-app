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
            .map(de => `- [${de.code}] ${de.name}`)
            .join("\n");

        const text = i18n.t(
            `
User {{user}} ({{username}}) has made an edition to a project which removes indicators with existing data.

Project: {{projectName}}

Removed indicators:

{{dataElementsList}}

The reason provided by the user was:

{{message}}`,
            {
                user,
                username,
                projectName: this.project.name,
                dataElementsList,
                message,
                nsSeparator: false,
            }
        );

        await this.sendMessage({ recipients, subject, text });
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

function html2Text(element: ReactElement): string {
    const html = ReactDOMServer.renderToStaticMarkup(element);
    const text = striptags(html, [], "\n");
    const textWithoutBlankLines = text.replace(/^\s*$(?:\r\n?|\n)/gm, "");
    return textWithoutBlankLines;
}

function getUrl(project: Project) {
    const path = generateUrl("projects", undefined, { search: project.code });
    return window.location.href.split("#")[0] + "#" + path;
}

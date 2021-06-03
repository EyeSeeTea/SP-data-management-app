import _ from "lodash";
import striptags from "striptags";
import ReactDOMServer from "react-dom/server";

import Project from "./Project";
import { ReactElement } from "react";
import i18n from "../locales";
import User from "./user";
import { generateUrl } from "../router";
import { D2Api } from "../types/d2-api";
import ProjectDb, { getStringDataValue } from "./ProjectDb";

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

    private async notifySave(element: ReactElement, recipients: Email[], action: Action) {
        const { api, project, currentUser } = this;
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
        await sendMessage(api, { recipients, subject, text });
    }

    private async notifyDanglingDataValues(recipients: Email[]) {
        const { api, project } = this;
        const dataValues = await new ProjectDb(project).getDanglingDataValues();
        const projectName = project.name;

        if (_.isEmpty(dataValues)) return;

        const subject = i18n.t("Project '{{projectName}}' [dangling data values]", { projectName });

        const text =
            i18n.t("Project '{{projectName}}' has dangling data values:", { projectName }) +
            "\n\n" +
            dataValues.map(getStringDataValue).join("\n");

        await sendMessage(api, { recipients, subject, text });
    }
}

async function sendMessage(
    api: D2Api,
    options: { recipients: string[]; subject: string; text: string }
): Promise<void> {
    try {
        await api.email.sendMessage(options).getData();
    } catch (err) {
        console.error(err);
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

import striptags from "striptags";
import ReactDOMServer from "react-dom/server";

import Project from "./Project";
import { ReactElement } from "react";
import i18n from "../locales";
import User from "./user";
import { generateUrl } from "../router";
import { D2Api } from "../types/d2-api";

type Email = string;
type Action = "create" | "update";

export class ProjectNotification {
    constructor(private api: D2Api, private project: Project, private currentUser: User) {}

    notifyOnProjectSave(element: ReactElement, recipients: Email[], action: Action) {
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
            getUrl(project),
            html2Text(element),
        ];

        api.email.sendMessage({
            recipients,
            subject,
            text: body.join("\n\n"),
        });
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

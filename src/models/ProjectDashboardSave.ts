import Project from "./Project";
import ProjectDashboard from "./ProjectDashboard";
import { D2Api } from "../types/d2-api";
import i18n from "../locales";

export default class {
    api: D2Api;

    constructor(public project: Project) {
        this.api = project.api;
    }

    async execute(): Promise<void> {
        const { project, api } = this;
        const dashboardsMetadata = new ProjectDashboard(project).generate();

        const response = await api.metadata
            .post(dashboardsMetadata)
            .getData()
            .catch(_err => null);

        if (!response || response.status !== "OK")
            throw new Error(i18n.t("Error saving dashboard"));
    }
}

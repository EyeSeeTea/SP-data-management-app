import Project from "./Project";
import ProjectDashboard from "./ProjectDashboard";
import { D2Api } from "../types/d2-api";
import i18n from "../locales";
import CountryDashboard from "./CountryDashboard";
import { flattenPayloads } from "../utils/dhis2";

export default class ProjectDashboardSave {
    api: D2Api;

    constructor(public project: Project) {
        this.api = project.api;
    }

    async execute(): Promise<void> {
        const { project, api } = this;
        const { config } = project;

        const projectDashboardsMetadata = (
            await ProjectDashboard.buildForProject(api, config, project)
        ).generate();

        const country = project.parentOrgUnit;
        if (!country) throw new Error("Project without country");
        const countryDashboard = await CountryDashboard.build(api, config, country.id);
        const countryDashboardMetadata = countryDashboard.generate();
        const metadata = flattenPayloads([projectDashboardsMetadata, countryDashboardMetadata]);

        const response = await api.metadata
            .post(metadata)
            .getData()
            .catch(_err => null);

        if (!response || response.status !== "OK")
            throw new Error(i18n.t("Error saving dashboard"));
    }
}

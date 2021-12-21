import _ from "lodash";
import { Config } from "./Config";
import { PartialPersistedModel, PartialModel, D2Api, D2Visualization } from "../types/d2-api";
import { Ref, D2DashboardItem, Id } from "../types/d2-api";
import Project from "./Project";
import i18n from "../locales";
import { getUid } from "../utils/dhis2";
import ProjectSharing from "./ProjectSharing";
import {
    getReportTableItem,
    getChartDashboardItem,
    toItemWidth,
    positionItems,
    dimensions,
    MaybeD2Visualization,
    getD2Visualization,
    PositionItemsOptions,
    Visualization,
    dataElementItems,
    indicatorItems,
    VisualizationDefinition,
} from "./Dashboard";
import { getActualTargetIndicators, getCostBenefitIndicators } from "./indicators";
import { Response } from "./Response";
import {
    ProjectsListDashboard,
    getProjectsListDashboard,
    DashboardSourceMetadata,
    Condition,
} from "./ProjectsListDashboard";
import { filterPeriods } from "./Period";

export default class ProjectDashboard {
    dataElements: ProjectsListDashboard["dataElements"];
    categoryOnlyNew: { id: Id; categoryOptions: Ref[] };

    constructor(private config: Config, private projectsListDashboard: ProjectsListDashboard) {
        this.dataElements = this.projectsListDashboard.dataElements;

        this.categoryOnlyNew = {
            id: config.categories.newRecurring.id,
            categoryOptions: [{ id: config.categoryOptions.new.id }],
        };

        this.config = config;
    }

    static async buildForProject(
        api: D2Api,
        config: Config,
        project: Ref,
        initialMetadata?: DashboardSourceMetadata
    ): Promise<ProjectDashboard> {
        const condition: Condition = { type: "project", id: project.id, initialMetadata };
        const projectsListDashboard = await getProjectsListDashboard(api, config, condition);
        return new ProjectDashboard(config, projectsListDashboard);
    }

    static async buildForAwardNumber(
        api: D2Api,
        config: Config,
        awardNumber: string,
        initialMetadata?: DashboardSourceMetadata
    ): Promise<ProjectDashboard> {
        const condition: Condition = { type: "awardNumber", value: awardNumber, initialMetadata };
        const projectsListDashboard = await getProjectsListDashboard(api, config, condition);
        return new ProjectDashboard(config, projectsListDashboard);
    }

    generate(options: { minimumOrgUnits?: number } = {}) {
        const { config, projectsListDashboard } = this;
        const { minimumOrgUnits } = options;

        if (!_.isNil(minimumOrgUnits) && projectsListDashboard.orgUnits.length < minimumOrgUnits)
            return { dashboards: [], visualizations: [] };

        const reportTables: Array<PartialPersistedModel<D2Visualization>> = _.compact([
            // General Data View
            this.targetVsActualBenefitsTable(),
            this.targetVsActualBenefitsWithDisaggregationTable(),
            this.targetVsActualPeopleTable(),
            this.targetVsActualUniquePeopleTable(),
            // Percent achieved (to date)
            this.achievedBenefitsTable({ toDate: true }),
            this.achievedBenefitsTotalToDateTable(),
            this.achievedPeopleTotalTable({ toDate: true }),
            // Percent achieved
            this.achievedBenefitsTable(),
            this.achievedPeopleTable(),
            this.achievedPeopleTotalTable(),
        ]);

        const charts: Array<PartialPersistedModel<D2Visualization>> = _.compact([
            this.achievedBenefitChart(),
            this.achievedPeopleChart(),
            this.genderChart(),
            this.costBenefitTable(),
        ]);

        const achievedMonthlyChart_ = this.achievedMonthlyChart();
        const favorites = {
            visualizations: _.concat(reportTables, _.compact([achievedMonthlyChart_, ...charts])),
        };

        const items: Array<PartialModel<D2DashboardItem>> = _.compact([
            ...reportTables.map(reportTable => getReportTableItem(reportTable)),
            getChartDashboardItem(achievedMonthlyChart_, { width: toItemWidth(100) }),
            ...charts.map(chart => getChartDashboardItem(chart)),
        ]);

        const positionItemsOptions: PositionItemsOptions = {
            maxWidth: toItemWidth(100),
            defaultWidth: toItemWidth(50),
            defaultHeight: 20, // 20 vertical units ~ 50% of viewport height
        };

        const dashboard = {
            id: getUid("dashboard", projectsListDashboard.id),
            name: projectsListDashboard.name,
            dashboardItems: positionItems(items, positionItemsOptions),
            ...new ProjectSharing(config, projectsListDashboard).getSharingAttributesForDashboard(),
        };

        return { dashboards: [dashboard], ...favorites };
    }

    targetVsActualBenefitsTable(): MaybeD2Visualization {
        const { config, dataElements } = this;
        const dataElementsNoDisaggregated = dataElements.benefit.filter(
            de => !de.categories.includes("newRecurring")
        );

        return this.getD2VisualizationFromDefinition({
            type: "table",
            key: "reportTable-target-actual-benefits",
            name: i18n.t("Target vs Actual - Benefits"),
            items: dataElementItems(dataElementsNoDisaggregated),
            filters: [dimensions.orgUnit],
            columns: [dimensions.period],
            rows: [dimensions.data, config.categories.targetActual],
        });
    }

    targetVsActualBenefitsWithDisaggregationTable(): MaybeD2Visualization {
        const { config, dataElements } = this;
        const dataElementsDisaggregated = dataElements.benefit.filter(de =>
            de.categories.includes("newRecurring")
        );

        return this.getD2VisualizationFromDefinition({
            type: "table",
            key: "reportTable-target-actual-benefits-disaggregated",
            name: i18n.t("Target vs Actual - Benefits (Disaggregated)"),
            items: dataElementItems(dataElementsDisaggregated),
            filters: [dimensions.orgUnit],
            columns: [dimensions.period],
            rows: [dimensions.data, config.categories.targetActual, config.categories.newRecurring],
        });
    }

    targetVsActualPeopleTable(): MaybeD2Visualization {
        const { config, dataElements } = this;

        return this.getD2VisualizationFromDefinition({
            type: "table",
            key: "reportTable-target-actual-people",
            name: i18n.t("Target vs Actual - People"),
            items: dataElementItems(dataElements.people),
            filters: [dimensions.orgUnit],
            columns: [dimensions.period, config.categories.gender],
            rows: [dimensions.data, config.categories.targetActual, config.categories.newRecurring],
        });
    }

    targetVsActualUniquePeopleTable(): MaybeD2Visualization {
        const { config, dataElements } = this;

        return this.getD2VisualizationFromDefinition({
            type: "table",
            key: "reportTable-target-actual-unique-people",
            name: i18n.t("Target vs Actual - Unique People"),
            items: dataElementItems(dataElements.people),
            filters: [dimensions.orgUnit, this.categoryOnlyNew],
            columns: [dimensions.period, config.categories.gender],
            rows: [dimensions.data, config.categories.targetActual],
        });
    }

    achievedBenefitsTable(options: VisualizationOptions = {}): MaybeD2Visualization {
        const { config, dataElements } = this;
        const indicators = getActualTargetIndicators(config, dataElements.benefit);

        return this.getD2VisualizationFromDefinition({
            type: "table",
            key: "reportTable-indicators-benefits" + (options.toDate ? "-todate" : ""),
            name: options.toDate
                ? i18n.t("Achieved to date (%) - Benefits")
                : i18n.t("Achieved (%) - Benefits"),
            items: indicatorItems(indicators),
            filters: [dimensions.orgUnit],
            columns: [dimensions.period],
            rows: [dimensions.data],
            extra: { legendSet: config.legendSets.achieved },
            ...options,
        });
    }

    achievedPeopleTable(): MaybeD2Visualization {
        const { config, dataElements } = this;
        const indicators = getActualTargetIndicators(this.config, dataElements.people);

        return this.getD2VisualizationFromDefinition({
            type: "table",
            key: "reportTable-indicators-people",
            name: i18n.t("Achieved (%) - People"),
            items: indicatorItems(indicators),
            filters: [dimensions.orgUnit],
            columns: [dimensions.period],
            rows: [dimensions.data],
            extra: { legendSet: config.legendSets.achieved },
            rowTotals: false,
        });
    }

    achievedPeopleTotalTable(options: VisualizationOptions = {}): MaybeD2Visualization {
        const { config, dataElements } = this;

        return this.getD2VisualizationFromDefinition({
            type: "table",
            key: "reportTable-indicators-people-total" + (options.toDate ? "-todate" : ""),
            name: options.toDate
                ? i18n.t("Achieved total to date (%) - People")
                : i18n.t("Achieved total (%) - People"),
            items: indicatorItems(getActualTargetIndicators(this.config, dataElements.people)),
            filters: [dimensions.orgUnit, dimensions.period],
            columns: [this.categoryOnlyNew],
            rows: [dimensions.data],
            extra: { legendSet: config.legendSets.achieved },
            rowTotals: false,
            ...options,
        });
    }

    achievedBenefitsTotalToDateTable(): MaybeD2Visualization {
        const { config, dataElements } = this;

        const dataElementsNoDisaggregated = dataElements.benefit.filter(de =>
            de.categories.includes("newRecurring")
        );

        return this.getD2VisualizationFromDefinition({
            type: "table",
            key: "reportTable-indicators-benefits-total-todate",
            name: i18n.t("Achieved total to date (%) - Benefits"),
            items: indicatorItems(
                getActualTargetIndicators(this.config, dataElementsNoDisaggregated)
            ),
            filters: [dimensions.orgUnit, dimensions.period],
            columns: [this.categoryOnlyNew],
            rows: [dimensions.data],
            extra: { legendSet: config.legendSets.achieved },
            rowTotals: false,
        });
    }

    achievedMonthlyChart(): MaybeD2Visualization {
        const { config, dataElements } = this;

        return this.getD2VisualizationFromDefinition({
            type: "chart",
            key: "chart-achieved-monthly",
            name: i18n.t("Achieved monthly (%)"),
            items: indicatorItems(getActualTargetIndicators(config, dataElements.all)),
            filters: [dimensions.orgUnit],
            columns: [dimensions.period],
            rows: [dimensions.data],
        });
    }

    achievedBenefitChart(): MaybeD2Visualization {
        const { config, dataElements } = this;

        return this.getD2VisualizationFromDefinition({
            type: "chart",
            key: "chart-achieved",
            name: i18n.t("Achieved Benefit (%)"),
            items: indicatorItems(getActualTargetIndicators(config, dataElements.benefit)),
            filters: [dimensions.period],
            columns: [dimensions.orgUnit],
            rows: [dimensions.data],
        });
    }

    achievedPeopleChart(): MaybeD2Visualization {
        const { config, dataElements } = this;

        return this.getD2VisualizationFromDefinition({
            type: "chart",
            key: "chart-people-achieved",
            name: i18n.t("Achieved People (%)"),
            items: indicatorItems(getActualTargetIndicators(config, dataElements.people)),
            filters: [dimensions.period, this.categoryOnlyNew],
            columns: [dimensions.orgUnit],
            rows: [dimensions.data],
        });
    }

    genderChart(): MaybeD2Visualization {
        const { config, dataElements } = this;

        return this.getD2VisualizationFromDefinition({
            type: "chart",
            key: "chart-achieved-gender",
            name: i18n.t("Achieved by gender (%)"),
            items: indicatorItems(getActualTargetIndicators(config, dataElements.people)),
            filters: [dimensions.orgUnit, dimensions.period, this.categoryOnlyNew],
            columns: [config.categories.gender],
            rows: [dimensions.data],
        });
    }

    costBenefitTable(): MaybeD2Visualization {
        const { config, dataElements } = this;

        const pairedDataElements = dataElements.benefit.filter(de => de.hasPairedDataElements);

        return this.getD2VisualizationFromDefinition({
            type: "chart",
            key: "cost-benefit",
            name: i18n.t("Benefits Per Person"),
            items: indicatorItems(getCostBenefitIndicators(config, pairedDataElements)),
            filters: [dimensions.period],
            columns: [dimensions.orgUnit],
            rows: [dimensions.data],
        });
    }

    getD2VisualizationFromDefinition(definition: VisualizationDefinition): MaybeD2Visualization {
        const { config, projectsListDashboard } = this;

        const visualization: Visualization = {
            ...definition,
            key: definition.key + projectsListDashboard.id,
            name: `${projectsListDashboard.name} - ${definition.name}`,
            organisationUnits: projectsListDashboard.orgUnits,
            periods: filterPeriods(projectsListDashboard.periods, definition),
            sharing: new ProjectSharing(
                config,
                projectsListDashboard
            ).getSharingAttributesForDashboard(),
        };

        const d2Visualization = getD2Visualization(visualization);

        return d2Visualization ? { ...d2Visualization, ...visualization.extra } : null;
    }
}

interface Dashboard {
    id: Id;
    name: string;
}

export async function getProjectDashboard(
    api: D2Api,
    config: Config,
    projectId: Id
): Promise<Response<Dashboard>> {
    const project = await Project.get(api, config, projectId).catch(_err => null);
    if (!project) return { type: "error" as const, message: "No dashboard found" };

    // Regenerate the dashboard, as it contains "to date" visualizations
    const metadata = (await ProjectDashboard.buildForProject(api, config, project)).generate();
    const dashboard = metadata.dashboards[0];
    if (!dashboard) return { type: "error", message: "Error generating dashboard" };

    const response = await api.metadata
        .post(metadata)
        .getData()
        .catch(_err => null);
    const newDashboard = { id: dashboard.id, name: project.name };
    const updateSuccessful = response && response.status === "OK";

    if (!updateSuccessful) {
        if (project.dashboard.project) {
            // There was an error saving the updated dashboard, but an old one existed, return it.
            console.error("Error saving dashboard", response);
            return { type: "success", data: project.dashboard.project };
        } else {
            return { type: "error", message: i18n.t("Error saving dashboard") };
        }
    } else {
        return { type: "success", data: newDashboard };
    }
}

export async function getAwardNumberDashboard(
    api: D2Api,
    config: Config,
    projectId: Id
): Promise<Response<Dashboard>> {
    const project = await Project.get(api, config, projectId).catch(_err => null);

    if (!project) {
        return { type: "error" as const, message: "No dashboard found" };
    } else if (project.dashboard.awardNumber) {
        return { type: "success" as const, data: project.dashboard.awardNumber };
    } else {
        const { awardNumber } = project;
        const generator = await ProjectDashboard.buildForAwardNumber(api, config, awardNumber);
        const metadata = generator.generate();
        const dashboard = metadata.dashboards[0];
        if (!dashboard) return { type: "error", message: "Error generating dashboard" };

        const response = await api.metadata
            .post(metadata)
            .getData()
            .catch(_err => null);
        const newDashboard = { id: dashboard.id, name: dashboard.name };
        const updateSuccessful = response && response.status === "OK";

        if (!updateSuccessful) {
            return { type: "error", message: i18n.t("Error saving dashboard") };
        } else {
            return { type: "success", data: newDashboard };
        }
    }
}

interface VisualizationOptions {
    toDate?: boolean;
}

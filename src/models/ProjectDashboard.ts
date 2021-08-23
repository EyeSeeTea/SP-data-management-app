import _ from "lodash";
import { Config } from "./Config";
import { PartialPersistedModel, PartialModel, D2Api } from "../types/d2-api";
import { D2ReportTable, Ref, D2Chart, D2DashboardItem, Id } from "../types/d2-api";
import Project from "./Project";
import i18n from "../locales";
import { getUid } from "../utils/dhis2";
import ProjectSharing from "./ProjectSharing";
import {
    getReportTableItem,
    getChartItem,
    toItemWidth,
    positionItems,
    MaybeD2Table,
    dimensions,
    getD2ReportTable,
    MaybeD2Chart,
    getD2Chart,
    PositionItemsOptions,
    Chart,
    Table,
    dataElementItems,
    indicatorItems,
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
            return { dashboards: [], reportTables: [], charts: [] };

        const reportTables: Array<PartialPersistedModel<D2ReportTable>> = _.compact([
            // General Data View
            this.targetVsActualBenefits(),
            this.targetVsActualBenefitsWithDisaggregation(),
            this.targetVsActualPeople(),
            this.targetVsActualUniquePeople(),
            // Percent achieved (to date)
            this.achievedBenefitsTable({ toDate: true }),
            this.achievedBenefitsTotalToDate(),
            this.achievedPeopleTotalTable({ toDate: true }),
            // Percent achieved
            this.achievedBenefitsTable(),
            this.achievedPeopleTable(),
            this.achievedPeopleTotalTable(),
        ]);

        const charts: Array<PartialPersistedModel<D2Chart>> = _.compact([
            this.achievedBenefitChart(),
            this.achievedPeopleChart(),
            this.genderChart(),
            this.costBenefit(),
        ]);

        const achievedMonthlyChart_ = this.achievedMonthlyChart();
        const favorites = { reportTables, charts: _.compact([achievedMonthlyChart_, ...charts]) };

        const items: Array<PartialModel<D2DashboardItem>> = _.compact([
            ...reportTables.map(reportTable => getReportTableItem(reportTable)),
            getChartItem(achievedMonthlyChart_, { width: toItemWidth(100) }),
            ...charts.map(chart => getChartItem(chart)),
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

    targetVsActualBenefits(): MaybeD2Table {
        const { config, dataElements } = this;
        const dataElementsNoDisaggregated = dataElements.benefit.filter(
            de => !de.categories.includes("newRecurring")
        );

        return this.getTable({
            key: "reportTable-target-actual-benefits",
            name: i18n.t("Target vs Actual - Benefits"),
            items: dataElementItems(dataElementsNoDisaggregated),
            reportFilter: [dimensions.orgUnit],
            columnDimensions: [dimensions.period],
            rowDimensions: [dimensions.data, config.categories.targetActual],
        });
    }

    targetVsActualBenefitsWithDisaggregation(): MaybeD2Table {
        const { config, dataElements } = this;
        const dataElementsDisaggregated = dataElements.benefit.filter(de =>
            de.categories.includes("newRecurring")
        );

        return this.getTable({
            key: "reportTable-target-actual-benefits-disaggregated",
            name: i18n.t("Target vs Actual - Benefits (Disaggregated)"),
            items: dataElementItems(dataElementsDisaggregated),
            reportFilter: [dimensions.orgUnit],
            columnDimensions: [dimensions.period],
            rowDimensions: [
                dimensions.data,
                config.categories.targetActual,
                config.categories.newRecurring,
            ],
        });
    }

    targetVsActualPeople(): MaybeD2Table {
        const { config, dataElements } = this;

        return this.getTable({
            key: "reportTable-target-actual-people",
            name: i18n.t("Target vs Actual - People"),
            items: dataElementItems(dataElements.people),
            reportFilter: [dimensions.orgUnit],
            columnDimensions: [dimensions.period, config.categories.gender],
            rowDimensions: [
                dimensions.data,
                config.categories.targetActual,
                config.categories.newRecurring,
            ],
        });
    }

    targetVsActualUniquePeople(): MaybeD2Table {
        const { config, dataElements } = this;

        return this.getTable({
            key: "reportTable-target-actual-unique-people",
            name: i18n.t("Target vs Actual - Unique People"),
            items: dataElementItems(dataElements.people),
            reportFilter: [dimensions.orgUnit, this.categoryOnlyNew],
            columnDimensions: [dimensions.period, config.categories.gender],
            rowDimensions: [dimensions.data, config.categories.targetActual],
        });
    }

    achievedBenefitsTable(options: VisualizationOptions = {}): MaybeD2Table {
        const { config, dataElements } = this;
        const indicators = getActualTargetIndicators(config, dataElements.benefit);

        return this.getTable({
            key: "reportTable-indicators-benefits" + (options.toDate ? "-todate" : ""),
            name: options.toDate
                ? i18n.t("Achieved to date (%) - Benefits")
                : i18n.t("Achieved (%) - Benefits"),
            items: indicatorItems(indicators),
            reportFilter: [dimensions.orgUnit],
            columnDimensions: [dimensions.period],
            rowDimensions: [dimensions.data],
            extra: { legendSet: config.legendSets.achieved },
            ...options,
        });
    }

    achievedPeopleTable(): MaybeD2Table {
        const { config, dataElements } = this;
        const indicators = getActualTargetIndicators(this.config, dataElements.people);

        return this.getTable({
            key: "reportTable-indicators-people",
            name: i18n.t("Achieved (%) - People"),
            items: indicatorItems(indicators),
            reportFilter: [dimensions.orgUnit],
            columnDimensions: [dimensions.period],
            rowDimensions: [dimensions.data],
            extra: { legendSet: config.legendSets.achieved },
            rowTotals: false,
        });
    }

    achievedPeopleTotalTable(options: VisualizationOptions = {}): MaybeD2Table {
        const { config, dataElements } = this;

        return this.getTable({
            key: "reportTable-indicators-people-total" + (options.toDate ? "-todate" : ""),
            name: options.toDate
                ? i18n.t("Achieved total to date (%) - People")
                : i18n.t("Achieved total (%) - People"),
            items: indicatorItems(getActualTargetIndicators(this.config, dataElements.people)),
            reportFilter: [dimensions.orgUnit, dimensions.period],
            columnDimensions: [this.categoryOnlyNew],
            rowDimensions: [dimensions.data],
            extra: { legendSet: config.legendSets.achieved },
            rowTotals: false,
            ...options,
        });
    }

    achievedBenefitsTotalToDate(): MaybeD2Table {
        const { config, dataElements } = this;

        const dataElementsNoDisaggregated = dataElements.benefit.filter(de =>
            de.categories.includes("newRecurring")
        );

        return this.getTable({
            key: "reportTable-indicators-benefits-total-todate",
            name: i18n.t("Achieved total to date (%) - Benefits"),
            items: indicatorItems(
                getActualTargetIndicators(this.config, dataElementsNoDisaggregated)
            ),
            reportFilter: [dimensions.orgUnit, dimensions.period],
            columnDimensions: [this.categoryOnlyNew],
            rowDimensions: [dimensions.data],
            extra: { legendSet: config.legendSets.achieved },
            rowTotals: false,
        });
    }

    achievedMonthlyChart(): MaybeD2Chart {
        const { config, dataElements } = this;

        return this.getChart({
            key: "chart-achieved-monthly",
            name: i18n.t("Achieved monthly (%)"),
            items: indicatorItems(getActualTargetIndicators(config, dataElements.all)),
            reportFilter: [dimensions.orgUnit],
            seriesDimension: dimensions.period,
            categoryDimension: dimensions.data,
        });
    }

    achievedBenefitChart(): MaybeD2Chart {
        const { config, dataElements } = this;

        return this.getChart({
            key: "chart-achieved",
            name: i18n.t("Achieved Benefit (%)"),
            items: indicatorItems(getActualTargetIndicators(config, dataElements.benefit)),
            reportFilter: [dimensions.period],
            seriesDimension: dimensions.orgUnit,
            categoryDimension: dimensions.data,
        });
    }

    achievedPeopleChart(): MaybeD2Chart {
        const { config, dataElements } = this;

        return this.getChart({
            key: "chart-people-achieved",
            name: i18n.t("Achieved People (%)"),
            items: indicatorItems(getActualTargetIndicators(config, dataElements.people)),
            reportFilter: [dimensions.period, this.categoryOnlyNew],
            seriesDimension: dimensions.orgUnit,
            categoryDimension: dimensions.data,
        });
    }

    genderChart(): MaybeD2Chart {
        const { config, dataElements } = this;

        return this.getChart({
            key: "chart-achieved-gender",
            name: i18n.t("Achieved by gender (%)"),
            items: indicatorItems(getActualTargetIndicators(config, dataElements.people)),
            reportFilter: [dimensions.orgUnit, dimensions.period, this.categoryOnlyNew],
            seriesDimension: config.categories.gender,
            categoryDimension: dimensions.data,
        });
    }

    costBenefit(): MaybeD2Chart {
        const { config, dataElements } = this;

        const pairedDataElements = dataElements.benefit.filter(de => de.hasPairedDataElements);

        return this.getChart({
            key: "cost-benefit",
            name: i18n.t("Benefits Per Person"),
            items: indicatorItems(getCostBenefitIndicators(config, pairedDataElements)),
            reportFilter: [dimensions.period],
            seriesDimension: dimensions.orgUnit,
            categoryDimension: dimensions.data,
        });
    }

    getChart(baseChart: BaseChart): MaybeD2Chart {
        const { config, projectsListDashboard } = this;
        const chart: Chart = {
            ...baseChart,
            key: baseChart.key + projectsListDashboard.id,
            name: `${projectsListDashboard.name} - ${baseChart.name}`,
            organisationUnits: projectsListDashboard.orgUnits,
            periods: filterPeriods(projectsListDashboard.periods, baseChart),
            sharing: new ProjectSharing(
                config,
                projectsListDashboard
            ).getSharingAttributesForDashboard(),
        };
        const d2Chart = getD2Chart(chart);

        return d2Chart ? { ...d2Chart, ...chart.extra } : null;
    }

    getTable(baseTable: BaseTable): MaybeD2Table {
        const { config, projectsListDashboard } = this;

        const table: Table = {
            ..._.omit(baseTable, ["toDate"]),
            key: baseTable.key + projectsListDashboard.id,
            name: `${projectsListDashboard.name} - ${baseTable.name}`,
            organisationUnits: projectsListDashboard.orgUnits,
            periods: filterPeriods(projectsListDashboard.periods, baseTable),
            sharing: new ProjectSharing(
                config,
                projectsListDashboard
            ).getSharingAttributesForDashboard(),
        };

        const d2Table = getD2ReportTable(table);

        return d2Table ? { ...d2Table, ...table.extra } : null;
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

type CommonKey = "key" | "name" | "extra" | "toDate" | "items" | "reportFilter";

type BaseTable = Pick<Table, CommonKey | "rowDimensions" | "columnDimensions" | "rowTotals">;

type BaseChart = Pick<Chart, CommonKey | "categoryDimension" | "seriesDimension">;

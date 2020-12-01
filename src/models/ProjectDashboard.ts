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
import { ProjectsListDashboard, getProjectsListDashboard } from "./ProjectsListDashboard";

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
        project: Ref
    ): Promise<ProjectDashboard> {
        const projectsListDashboard = await getProjectsListDashboard(api, config, {
            type: "project",
            id: project.id,
        });

        return new ProjectDashboard(config, projectsListDashboard);
    }

    static async buildForAwardNumber(
        api: D2Api,
        config: Config,
        awardNumber: string
    ): Promise<ProjectDashboard> {
        const projectsListDashboard = await getProjectsListDashboard(api, config, {
            type: "awardNumber",
            value: awardNumber,
        });

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
            this.targetVsActualPeople(),
            this.targetVsActualUniquePeople(),
            // Percent achieved (to date)
            this.achievedBenefitsTable({ toDate: true }),
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

        return this.getTable({
            key: "reportTable-target-actual-benefits",
            name: i18n.t("Target vs Actual - Benefits"),
            items: dataElementItems(dataElements.benefit),
            reportFilter: [dimensions.orgUnit],
            columnDimensions: [dimensions.period],
            rowDimensions: [dimensions.data, config.categories.targetActual],
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
            periods: projectsListDashboard.periods,
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
            periods: projectsListDashboard.periods,
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
    let project: Project;
    try {
        project = await Project.get(api, config, projectId);
    } catch (err) {
        const msg = err.message || err;
        return { type: "error", message: i18n.t(`Cannot load project: ${msg}`) };
    }

    const metadata = (await ProjectDashboard.buildForProject(api, config, project)).generate();
    const dashboard = metadata.dashboards[0];
    if (!dashboard) return { type: "error", message: "Error generating dashboard" };

    const response = await api.metadata
        .post(metadata)
        .getData()
        .catch(_err => null);
    const newDashboard = { id: dashboard.id, name: project.name };
    const updateSuccessful = !response || response.status !== "OK";

    if (updateSuccessful) {
        if (project.dashboard.project) {
            // There was an error saving the updated dashboard, but an old one existed, return it.
            console.error("Error saving dashboard", response);
            return { type: "success", data: { ...project.dashboard.project, name: project.name } };
        } else {
            return { type: "error", message: i18n.t("Error saving dashboard") };
        }
    } else {
        return { type: "success", data: newDashboard };
    }
}

interface VisualizationOptions {
    toDate?: boolean;
}

type BaseTableKey =
    | "key"
    | "name"
    | "items"
    | "extra"
    | "reportFilter"
    | "rowDimensions"
    | "columnDimensions"
    | "rowTotals";

type BaseTable = Pick<Table, BaseTableKey> & VisualizationOptions;

type BaseChart = Pick<
    Chart,
    "key" | "name" | "items" | "reportFilter" | "categoryDimension" | "extra" | "seriesDimension"
>;

import _ from "lodash";
import { Config } from "./Config";
import { PartialPersistedModel, PartialModel } from "../types/d2-api";
import { D2Dashboard, D2ReportTable, Ref, D2Chart, D2DashboardItem, Id } from "../types/d2-api";
import Project from "./Project";
import i18n from "../locales";
import { getUid, getIds } from "../utils/dhis2";
import { DataElement } from "./dataElementsSet";
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

export default class ProjectDashboard {
    dataElements: Record<"all" | "people" | "benefit", DataElement[]>;
    categoryOnlyNew: { id: Id; categoryOptions: Ref[] };
    config: Config;

    constructor(public project: Project) {
        const { config } = project;

        this.dataElements = {
            all: project.getSelectedDataElements(),
            people: project.getSelectedDataElements({ peopleOrBenefit: "people" }),
            benefit: project.getSelectedDataElements({ peopleOrBenefit: "benefit" }),
        };

        this.categoryOnlyNew = {
            id: config.categories.newRecurring.id,
            categoryOptions: [{ id: config.categoryOptions.new.id }],
        };

        this.config = config;
    }

    generate() {
        const { project } = this;

        const reportTables: Array<PartialPersistedModel<D2ReportTable>> = _.compact([
            // General Data View
            this.targetVsActualBenefits(),
            this.targetVsActualPeople(),
            this.targetVsActualUniquePeople(),
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

        const dashboard: PartialPersistedModel<D2Dashboard> = {
            id: getUid("dashboard", project.uid),
            name: project.name,
            dashboardItems: positionItems(items, positionItemsOptions),
            ...new ProjectSharing(project).getSharingAttributesForDashboard(),
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
        const { project, dataElements } = this;
        const { config } = project;

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
        const { project, dataElements } = this;
        const { config } = project;

        return this.getTable({
            key: "reportTable-target-actual-unique-people",
            name: i18n.t("Target vs Actual - Unique People"),
            items: dataElementItems(dataElements.people),
            reportFilter: [dimensions.orgUnit, this.categoryOnlyNew],
            columnDimensions: [dimensions.period, config.categories.gender],
            rowDimensions: [dimensions.data, config.categories.targetActual],
        });
    }

    achievedBenefitsTable(): MaybeD2Table {
        const { config, project, dataElements } = this;
        const indicators = getActualTargetIndicators(config, dataElements.benefit);

        return this.getTable({
            key: "reportTable-indicators-benefits",
            name: i18n.t("Achieved (%) - Benefits"),
            items: indicatorItems(indicators),
            reportFilter: [dimensions.orgUnit],
            columnDimensions: [dimensions.period],
            rowDimensions: [dimensions.data],
            extra: { legendSet: project.config.legendSets.achieved },
        });
    }

    achievedPeopleTable(): MaybeD2Table {
        const { project, dataElements } = this;
        const indicators = getActualTargetIndicators(this.config, dataElements.people);

        return this.getTable({
            key: "reportTable-indicators-people",
            name: i18n.t("Achieved (%) - People"),
            items: indicatorItems(indicators),
            reportFilter: [dimensions.orgUnit],
            columnDimensions: [dimensions.period],
            rowDimensions: [dimensions.data],
            extra: { legendSet: project.config.legendSets.achieved },
            rowTotals: false,
        });
    }

    achievedPeopleTotalTable(): MaybeD2Table {
        const { project, dataElements } = this;

        return this.getTable({
            key: "reportTable-indicators-people-total",
            name: i18n.t("Achieved total (%) - People"),
            items: indicatorItems(getActualTargetIndicators(this.config, dataElements.people)),
            reportFilter: [dimensions.orgUnit, dimensions.period],
            columnDimensions: [this.categoryOnlyNew],
            rowDimensions: [dimensions.data],
            extra: { legendSet: project.config.legendSets.achieved },
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
        const { project, config, dataElements } = this;

        return this.getChart({
            key: "chart-achieved-gender",
            name: i18n.t("Achieved by gender (%)"),
            items: indicatorItems(getActualTargetIndicators(config, dataElements.people)),
            reportFilter: [dimensions.orgUnit, dimensions.period, this.categoryOnlyNew],
            seriesDimension: project.config.categories.gender,
            categoryDimension: dimensions.data,
        });
    }

    costBenefit(): MaybeD2Chart {
        const { config, dataElements } = this;

        const pairedDataElements = dataElements.benefit.filter(
            de => de.pairedDataElements.length > 0
        );

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
        const { project } = this;
        const chart: Chart = {
            ...baseChart,
            key: baseChart.key + project.uid,
            name: `${project.name} - ${baseChart.name}`,
            organisationUnits: [{ id: getOrgUnitId(project) }],
            periods: getIds(project.getPeriods()),
            sharing: new ProjectSharing(project).getSharingAttributesForDashboard(),
        };
        const d2Chart = getD2Chart(chart);

        return d2Chart ? { ...d2Chart, ...chart.extra } : null;
    }

    getTable(baseTable: BaseTable): MaybeD2Table {
        const { project } = this;

        const table: Table = {
            ...baseTable,
            key: baseTable.key + project.uid,
            name: `${project.name} - ${baseTable.name}`,
            organisationUnits: [{ id: getOrgUnitId(project) }],
            periods: getIds(project.getPeriods()),
            sharing: new ProjectSharing(project).getSharingAttributesForDashboard(),
        };

        const d2Table = getD2ReportTable(table);

        return d2Table ? { ...d2Table, ...table.extra } : null;
    }
}

function getOrgUnitId(project: Project): string {
    const ou = project.orgUnit;
    if (!ou) {
        throw new Error("No organisation defined for project");
    } else {
        return _.last(ou.path.split("/")) || "";
    }
}

type BaseTable = Pick<
    Table,
    | "key"
    | "name"
    | "items"
    | "reportFilter"
    | "extra"
    | "rowDimensions"
    | "columnDimensions"
    | "rowTotals"
>;

type BaseChart = Pick<
    Chart,
    "key" | "name" | "items" | "reportFilter" | "categoryDimension" | "extra" | "seriesDimension"
>;

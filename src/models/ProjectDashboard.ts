import { PartialPersistedModel, PartialModel } from "d2-api/api/common";
import _ from "lodash";
import { D2Dashboard, D2ReportTable, Ref, D2Chart, D2DashboardItem, Id } from "d2-api";
import Project from "./Project";
import i18n from "../locales";
import { getUid } from "../utils/dhis2";
import { DataElement } from "./dataElementsSet";

type Maybe<T> = T | null | undefined;

export default class ProjectDashboard {
    dataElements: Record<"all" | "people" | "benefit", DataElement[]>;
    categoryOnlyNew: { id: Id; categoryOptions: Ref[] };

    constructor(public project: Project) {
        const { config } = project;

        this.dataElements = {
            all: project.getSelectedDataElements(),
            people: project.getSelectedDataElements({ peopleOrBenefit: "people" }),
            benefit: project.getSelectedDataElements({ peopleOrBenefit: "benefit" }),
        };

        this.categoryOnlyNew = {
            id: config.categories.newRecurring.id,
            categoryOptions: [config.categoryOptions.new],
        };
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
        ]);

        const charts: Array<PartialPersistedModel<D2Chart>> = _.compact([
            this.achievedChart(),
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

        const dashboard: PartialPersistedModel<D2Dashboard> = {
            id: getUid("dashboard", project.uid),
            publicAccess: "rw------",
            name: project.name,
            dashboardItems: positionItems(items),
        };

        return { dashboards: [dashboard], ...favorites };
    }

    targetVsActualBenefits(): MaybeD2Table {
        const { project, dataElements } = this;
        const { config } = project;

        return getReportTable(project, {
            key: "reportTable-target-actual-benefits",
            name: i18n.t("Target vs Actual - Benefits"),
            items: dataElements.benefit,
            reportFilter: [dimensions.orgUnit],
            columnDimensions: [dimensions.period],
            rowDimensions: [dimensions.data, config.categories.targetActual],
        });
    }

    targetVsActualPeople(): MaybeD2Table {
        const { project, dataElements } = this;
        const { config } = project;

        return getReportTable(project, {
            key: "reportTable-target-actual-people",
            name: i18n.t("Target vs Actual - People"),
            items: dataElements.people,
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

        return getReportTable(project, {
            key: "reportTable-target-actual-unique-people",
            name: i18n.t("Target vs Actual - Unique People"),
            items: dataElements.people,
            reportFilter: [dimensions.orgUnit, this.categoryOnlyNew],
            columnDimensions: [dimensions.period, config.categories.gender],
            rowDimensions: [dimensions.data, config.categories.targetActual],
        });
    }

    achievedBenefitsTable(): MaybeD2Table {
        const { project, dataElements } = this;
        const indicators = project.getActualTargetIndicators(dataElements.benefit);

        return getReportTable(project, {
            key: "reportTable-indicators-benefits",
            name: i18n.t("Achieved (%) - Benefits"),
            items: indicators,
            reportFilter: [dimensions.orgUnit],
            columnDimensions: [dimensions.period],
            rowDimensions: [dimensions.data],
            extra: { legendSet: project.config.legendSets.achieved },
        });
    }

    achievedPeopleTable(): MaybeD2Table {
        const { project, dataElements } = this;

        return getReportTable(project, {
            key: "reportTable-indicators-people",
            name: i18n.t("Achieved (%) - People"),
            items: project.getActualTargetIndicators(dataElements.people),
            reportFilter: [dimensions.orgUnit],
            columnDimensions: [dimensions.period],
            rowDimensions: [dimensions.data],
            extra: { legendSet: project.config.legendSets.achieved },
        });
    }

    achievedMonthlyChart(): MaybeD2Chart {
        const { project, dataElements } = this;

        return getChart(project, {
            key: "chart-achieved-monthly",
            name: i18n.t("Achieved monthly (%)"),
            items: project.getActualTargetIndicators(dataElements.all),
            reportFilter: [dimensions.orgUnit],
            seriesDimension: dimensions.period,
            categoryDimension: dimensions.data,
        });
    }

    achievedChart(): MaybeD2Chart {
        const { project, dataElements } = this;

        return getChart(project, {
            key: "chart-achieved",
            name: i18n.t("Achieved (%)"),
            items: project.getActualTargetIndicators(dataElements.all),
            reportFilter: [dimensions.period],
            seriesDimension: dimensions.orgUnit,
            categoryDimension: dimensions.data,
        });
    }

    genderChart(): MaybeD2Chart {
        const { project, dataElements } = this;

        return getChart(project, {
            key: "chart-achieved-gender",
            name: i18n.t("Achieved by gender (%)"),
            items: project.getActualTargetIndicators(dataElements.people),
            reportFilter: [dimensions.orgUnit, dimensions.period, this.categoryOnlyNew],
            seriesDimension: project.config.categories.gender,
            categoryDimension: dimensions.data,
        });
    }

    costBenefit(): MaybeD2Chart {
        const { project, dataElements } = this;
        const pairedDataElements = dataElements.benefit.filter(
            de => de.pairedDataElements.length > 0
        );

        return getChart(project, {
            key: "cost-benefit",
            name: i18n.t("Benefits Per Person"),
            items: project.getCostBenefitIndicators(pairedDataElements),
            reportFilter: [dimensions.period],
            seriesDimension: dimensions.orgUnit,
            categoryDimension: dimensions.data,
        });
    }
}

const dimensions = {
    period: { id: "pe" },
    orgUnit: { id: "ou" },
    data: { id: "dx" },
};

function getOrgUnitId(project: Project): string {
    const ou = project.orgUnit;
    if (!ou) {
        throw new Error("No organisation defined for project");
    } else {
        return _.last(ou.path.split("/")) || "";
    }
}

type Dimension = { id: string; categoryOptions?: Ref[] };

interface Table {
    key: string;
    name: string;
    items: Ref[];
    reportFilter: Dimension[];
    rowDimensions: Dimension[];
    columnDimensions: Dimension[];
    extra?: PartialModel<D2ReportTable>;
}

interface Chart {
    key: string;
    name: string;
    items: Ref[];
    reportFilter: Dimension[];
    seriesDimension: Dimension;
    categoryDimension: Dimension;
    extra?: PartialModel<D2Chart>;
}

type MaybeD2Table = Maybe<PartialPersistedModel<D2ReportTable>>;

type MaybeD2Chart = Maybe<PartialPersistedModel<D2Chart>>;

function getDataDimensionItems(project: Project, items: Ref[]) {
    const { config } = project;
    const dataElementIds = new Set(project.getSelectedDataElements().map(de => de.id));
    const indicatorIds = new Set(config.indicators.map(ind => ind.id));

    return _(items)
        .map(item => {
            if (dataElementIds.has(item.id)) {
                return { dataDimensionItemType: "DATA_ELEMENT", dataElement: { id: item.id } };
            } else if (indicatorIds.has(item.id)) {
                return { dataDimensionItemType: "INDICATOR", indicator: { id: item.id } };
            } else {
                console.error(`Unsupported item: ${item.id}`);
                return null;
            }
        })
        .compact()
        .value();
}

function getReportTable(project: Project, table: Table): MaybeD2Table {
    if (_.isEmpty(table.items)) return null;

    const orgUnitId = getOrgUnitId(project);
    const dataDimensionItems = getDataDimensionItems(project, table.items);
    const dimensions = _.concat(table.columnDimensions, table.rowDimensions, table.reportFilter);

    const baseTable: PartialPersistedModel<D2ReportTable> = {
        id: getUid(table.key, project.uid),
        name: `${project.name} - ${table.name}`,
        numberType: "VALUE",
        publicAccess: "rw------",
        legendDisplayStyle: "FILL",
        rowSubTotals: true,
        showDimensionLabels: true,
        aggregationType: "DEFAULT",
        legendDisplayStrategy: "FIXED",
        rowTotals: true,
        digitGroupSeparator: "SPACE",
        dataDimensionItems,
        organisationUnits: [{ id: orgUnitId }],
        periods: project.getPeriods().map(period => ({ id: period.id })),
        columns: table.columnDimensions,
        columnDimensions: table.columnDimensions.map(dimension => dimension.id),
        filters: table.reportFilter,
        filterDimensions: table.reportFilter.map(dimension => dimension.id),
        rows: table.rowDimensions,
        rowDimensions: table.rowDimensions.map(dimension => dimension.id),
        categoryDimensions: getCategoryDimensions(dimensions),
    };

    return _.merge({}, baseTable, table.extra || {});
}

function getCategoryDimensions(dimensions: Dimension[]) {
    return _.compact(
        dimensions.map(dimension =>
            dimension.categoryOptions
                ? {
                      category: { id: dimension.id },
                      categoryOptions: dimension.categoryOptions.map(co => ({ id: co.id })),
                  }
                : null
        )
    );
}

function getChart(project: Project, chart: Chart): MaybeD2Chart {
    if (_.isEmpty(chart.items)) return null;
    const dimensions = [...chart.reportFilter, chart.seriesDimension, chart.categoryDimension];

    const baseChart: PartialPersistedModel<D2Chart> = {
        id: getUid(chart.key, project.uid),
        name: `${project.name} - ${chart.name}`,
        publicAccess: "rw------",
        type: "COLUMN",
        aggregationType: "DEFAULT",
        showData: true,
        category: chart.categoryDimension.id,
        organisationUnits: [{ id: getOrgUnitId(project) }],
        dataDimensionItems: getDataDimensionItems(project, chart.items),
        periods: project.getPeriods().map(period => ({ id: period.id })),
        series: chart.seriesDimension.id,
        columns: [chart.seriesDimension],
        rows: [chart.categoryDimension],
        filters: chart.reportFilter,
        filterDimensions: chart.reportFilter.map(dimension => dimension.id),
        categoryDimensions: getCategoryDimensions(dimensions),
    };

    return _.merge({}, baseChart, chart.extra || {});
}

function getReportTableItem(
    reportTable: Maybe<PartialPersistedModel<D2ReportTable>>,
    dashboardItemAttributes?: PartialModel<D2DashboardItem>
) {
    if (!reportTable) return null;
    return {
        id: getUid("dashboardItem", reportTable.id),
        type: "REPORT_TABLE" as const,
        reportTable: { id: reportTable.id },
        ...(dashboardItemAttributes || {}),
    };
}

function getChartItem(
    chart: Maybe<PartialPersistedModel<D2Chart>>,
    dashboardItemAttributes?: PartialModel<D2DashboardItem>
) {
    if (!chart) return null;
    return {
        id: getUid("dashboardItem", chart.id),
        type: "CHART" as const,
        chart: { id: chart.id },
        ...(dashboardItemAttributes || {}),
    };
}

type Pos = { x: number; y: number };
type Item = PartialModel<D2DashboardItem>;

function toItemWidth(percentWidth: number) {
    // 58 units = 100% of screen width (60 is too wide, it overflows)
    return (percentWidth * 58) / 100;
}

const positionItemsConfig = {
    maxWidth: toItemWidth(100),
    defaultWidth: toItemWidth(50),
    defaultHeight: 20, // 20 vertical units ~ 50% of viewport height
};

/* Set attributes x, y, width and height for an array of dashboard items */
function positionItems(items: Array<Item>) {
    const { maxWidth, defaultWidth, defaultHeight } = positionItemsConfig;
    const initialPos = { x: 0, y: 0 };

    return items.reduce<{ pos: Pos; outputItems: Item[] }>(
        ({ pos, outputItems }, item) => {
            const width = Math.min(item.width || defaultWidth, maxWidth);
            const itemPos = pos.x + width > maxWidth ? { x: 0, y: pos.y + defaultHeight } : pos;
            const newItem = { ...item, width, height: defaultHeight, ...itemPos };
            const newPos = { x: itemPos.x + newItem.width, y: itemPos.y };
            return { pos: newPos, outputItems: [...outputItems, newItem] };
        },
        { pos: initialPos, outputItems: [] }
    ).outputItems;
}

import { PartialPersistedModel, PartialModel } from "d2-api/api/common";
import _ from "lodash";
import { D2Dashboard, D2ReportTable, Ref, D2Chart, D2DashboardItem, Id } from "d2-api";
import Project from "./Project";
import i18n from "../locales";
import { getUid } from "../utils/dhis2";
import { DataElement } from "./dataElementsSet";

type Maybe<T> = T | null;

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
            this.achievedMonthlyChart(),
            this.achievedChart(),
            this.genderChart(),
            this.costBenefit(),
        ]);
        const items: Array<PartialModel<D2DashboardItem>> = [
            ...charts.map(chart => ({
                id: getUid("dashboardItem", chart.id),
                type: "CHART" as const,
                chart: { id: chart.id },
            })),
            ...reportTables.map(reportTable => ({
                id: getUid("dashboardItem", reportTable.id),
                type: "REPORT_TABLE" as const,
                reportTable: { id: reportTable.id },
            })),
        ];
        const dashboard: PartialPersistedModel<D2Dashboard> = {
            id: getUid("dashboard", project.uid),
            name: project.name,
            dashboardItems: items,
        };

        return { dashboards: [dashboard], reportTables, charts };
    }

    targetVsActualBenefits(): MaybeD2Table {
        const { project, dataElements } = this;
        const { config } = project;

        return getReportTable(project, {
            key: "reportTable-target-actual-benefits",
            name: i18n.t("PM Target vs Actual - Benefits"),
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
            name: i18n.t("PM Target vs Actual - People"),
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
            name: i18n.t("PM Target vs Actual - Unique People"),
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
            name: i18n.t("PM achieved (%) - Benefits"),
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
            name: i18n.t("PM achieved (%) - People"),
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
            name: i18n.t("PM achieved monthly (%)"),
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
            name: i18n.t("PM achieved (%)"),
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
            name: i18n.t("PM achieved by gender (%)"),
            items: project.getActualTargetIndicators(dataElements.people),
            reportFilter: [dimensions.orgUnit, dimensions.period, this.categoryOnlyNew],
            seriesDimension: project.config.categories.gender,
            categoryDimension: dimensions.data,
        });
    }

    costBenefit(): MaybeD2Chart {
        const { project, dataElements } = this;
        const pairedDataElements = dataElements.benefit.filter(de => de.pairedDataElement);

        return getChart(project, {
            key: "cost-benefit",
            name: i18n.t("PM Benefits Per Person (%)"),
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

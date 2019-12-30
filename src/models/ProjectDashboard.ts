import { PartialPersistedModel, PartialModel } from "d2-api/api/common";
import _ from "lodash";
import { D2Dashboard, D2ReportTable, Ref, D2Chart, D2DashboardItem } from "d2-api";
import Project from "./Project";
import i18n from "../locales";
import { getUid } from "../utils/dhis2";

type Maybe<T> = T | null;

export default class ProjectDashboard {
    constructor(public project: Project) {}

    generate() {
        const { project } = this;
        const reportTables: Array<PartialPersistedModel<D2ReportTable>> = _.compact([
            // General Data View
            targetVsActualBenefits(project),
            targetVsActualPeople(project),
            targetVsActualUniquePeople(project),
            // Percent achieved
            achievedBenefitsTable(project),
            achievedPeopleTable(project),
        ]);
        const charts: Array<PartialPersistedModel<D2Chart>> = _.compact([
            achievedMonthlyChart(project),
            achievedChart(project),
            genderChart(project),
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
}

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

type MaybeD2Table = Maybe<PartialPersistedModel<D2ReportTable>>;

interface Chart {
    key: string;
    name: string;
    items: Ref[];
    reportFilter: Dimension[];
    seriesDimension: Dimension;
    categoryDimension: Dimension;
    extra?: PartialModel<D2Chart>;
}

type MaybeD2Chart = Maybe<PartialPersistedModel<D2Chart>>;

function getDataDimensionItems(project: Project, items: Ref[]) {
    const { config } = project;
    const dataElementIds = new Set(
        project.dataElements.get({ includePaired: true }).map(de => de.id)
    );
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
        periods: project.getPeriods(),
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
        periods: project.getPeriods(),
        series: chart.seriesDimension.id,
        columns: [chart.seriesDimension],
        rows: [chart.categoryDimension],
        filters: chart.reportFilter,
        filterDimensions: chart.reportFilter.map(dimension => dimension.id),
        categoryDimensions: getCategoryDimensions(dimensions),
    };

    return _.merge({}, baseChart, chart.extra || {});
}

function targetVsActualBenefits(project: Project): MaybeD2Table {
    const { config } = project;
    const dataElements = project.dataElements.get({
        onlySelected: true,
        includePaired: true,
        peopleOrBenefit: "benefit",
    });

    return getReportTable(project, {
        key: "reportTable-target-actual-benefits",
        name: i18n.t("PM Target vs Actual - Benefits"),
        items: dataElements,
        reportFilter: [{ id: "ou" }],
        columnDimensions: [{ id: "pe" }],
        rowDimensions: [{ id: "dx" }, config.categories.targetActual],
    });
}

function targetVsActualPeople(project: Project): MaybeD2Table {
    const { config } = project;
    const dataElements = project.dataElements.get({
        onlySelected: true,
        includePaired: true,
        peopleOrBenefit: "people",
    });

    return getReportTable(project, {
        key: "reportTable-target-actual-people",
        name: i18n.t("PM Target vs Actual - People"),
        items: dataElements,
        reportFilter: [{ id: "ou" }],
        columnDimensions: [{ id: "pe" }, config.categories.gender],
        rowDimensions: [
            { id: "dx" },
            config.categories.targetActual,
            config.categories.newRecurring,
        ],
    });
}

function targetVsActualUniquePeople(project: Project): MaybeD2Table {
    const { config } = project;
    const dataElements = project.dataElements.get({
        onlySelected: true,
        includePaired: true,
        peopleOrBenefit: "people",
    });

    const categoryNew = {
        id: config.categories.newRecurring.id,
        categoryOptions: [config.categoryOptions.new],
    };

    return getReportTable(project, {
        key: "reportTable-target-actual-unique-people",
        name: i18n.t("PM Target vs Actual - Unique People"),
        items: dataElements,
        reportFilter: [{ id: "ou" }, categoryNew],
        columnDimensions: [{ id: "pe" }, config.categories.gender],
        rowDimensions: [{ id: "dx" }, config.categories.targetActual],
    });
}

function achievedBenefitsTable(project: Project): MaybeD2Table {
    const dataElements = project.dataElements.get({
        onlySelected: true,
        includePaired: true,
        peopleOrBenefit: "benefit",
    });
    const indicators = project.getActualTargetIndicators(dataElements);

    return getReportTable(project, {
        key: "reportTable-indicators-benefits",
        name: i18n.t("PM achieved (%) - Benefits"),
        items: indicators,
        reportFilter: [{ id: "ou" }],
        columnDimensions: [{ id: "pe" }],
        rowDimensions: [{ id: "dx" }],
        extra: { legendSet: project.config.legendSets.achieved },
    });
}

function achievedPeopleTable(project: Project): MaybeD2Table {
    const dataElements = project.dataElements.get({
        onlySelected: true,
        includePaired: true,
        peopleOrBenefit: "people",
    });

    return getReportTable(project, {
        key: "reportTable-indicators-people",
        name: i18n.t("PM achieved (%) - People"),
        items: project.getActualTargetIndicators(dataElements),
        reportFilter: [{ id: "ou" }],
        columnDimensions: [{ id: "pe" }],
        rowDimensions: [{ id: "dx" }],
        extra: { legendSet: project.config.legendSets.achieved },
    });
}

function achievedMonthlyChart(project: Project): MaybeD2Chart {
    const dataElements = project.dataElements.get({
        onlySelected: true,
        includePaired: true,
    });

    return getChart(project, {
        key: "chart-achieved-monthly",
        name: i18n.t("PM achieved monthly (%)"),
        items: project.getActualTargetIndicators(dataElements),
        reportFilter: [{ id: "ou" }],
        seriesDimension: { id: "pe" },
        categoryDimension: { id: "dx" },
    });
}

function achievedChart(project: Project): MaybeD2Chart {
    const dataElements = project.dataElements.get({
        onlySelected: true,
        includePaired: true,
    });

    return getChart(project, {
        key: "chart-achieved",
        name: i18n.t("PM achieved (%)"),
        items: project.getActualTargetIndicators(dataElements),
        reportFilter: [{ id: "pe" }],
        seriesDimension: { id: "ou" },
        categoryDimension: { id: "dx" },
    });
}

function genderChart(project: Project): MaybeD2Chart {
    const dataElements = project.dataElements.get({
        onlySelected: true,
        includePaired: true,
    });

    return getChart(project, {
        key: "chart-achieved-gender",
        name: i18n.t("PM achieved by gender (%)"),
        items: project.getActualTargetIndicators(dataElements),
        reportFilter: [{ id: "ou" }, { id: "pe" }],
        seriesDimension: project.config.categories.gender,
        categoryDimension: { id: "dx" },
    });
}

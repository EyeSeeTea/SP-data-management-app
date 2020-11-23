import _ from "lodash";
import Project from "./Project";
import {
    Ref,
    PartialModel,
    D2ReportTable,
    D2Chart,
    PartialPersistedModel,
    D2DashboardItem,
} from "../types/d2-api";
import { Maybe } from "../types/utils";
import { getUid } from "../utils/dhis2";
import ProjectSharing from "./ProjectSharing";

export const dimensions = {
    period: { id: "pe" },
    orgUnit: { id: "ou" },
    data: { id: "dx" },
};

export function getOrgUnitId(project: Project): string {
    const ou = project.orgUnit;
    if (!ou) {
        throw new Error("No organisation defined for project");
    } else {
        return _.last(ou.path.split("/")) || "";
    }
}

export type Dimension = { id: string; categoryOptions?: Ref[] };

export interface Table {
    key: string;
    name: string;
    items: Ref[];
    reportFilter: Dimension[];
    rowDimensions: Dimension[];
    columnDimensions: Dimension[];
    extra?: PartialModel<D2ReportTable>;
    rowTotals?: boolean;
}

export interface Chart {
    key: string;
    name: string;
    items: Ref[];
    reportFilter: Dimension[];
    seriesDimension: Dimension;
    categoryDimension: Dimension;
    extra?: PartialModel<D2Chart>;
}

export type MaybeD2Table = Maybe<PartialPersistedModel<D2ReportTable>>;

export type MaybeD2Chart = Maybe<PartialPersistedModel<D2Chart>>;

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

export function getReportTable(project: Project, table: Table): MaybeD2Table {
    if (_.isEmpty(table.items)) return null;

    const orgUnitId = getOrgUnitId(project);
    const dataDimensionItems = getDataDimensionItems(project, table.items);
    const dimensions = _.concat(table.columnDimensions, table.rowDimensions, table.reportFilter);

    const baseTable: PartialPersistedModel<D2ReportTable> = {
        id: getUid(table.key, project.uid),
        name: `${project.name} - ${table.name}`,
        numberType: "VALUE",
        legendDisplayStyle: "FILL",
        rowSubTotals: true,
        showDimensionLabels: true,
        aggregationType: "DEFAULT",
        legendDisplayStrategy: "FIXED",
        rowTotals: table.rowTotals ?? true,
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
        ...new ProjectSharing(project).getSharingAttributesForDashboard(),
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

export function getChart(project: Project, chart: Chart): MaybeD2Chart {
    if (_.isEmpty(chart.items)) return null;
    const dimensions = [...chart.reportFilter, chart.seriesDimension, chart.categoryDimension];

    const baseChart: PartialPersistedModel<D2Chart> = {
        id: getUid(chart.key, project.uid),
        name: `${project.name} - ${chart.name}`,
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
        ...new ProjectSharing(project).getSharingAttributesForDashboard(),
    };

    return _.merge({}, baseChart, chart.extra || {});
}

export function getReportTableItem(
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

export function getChartItem(
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

export function toItemWidth(percentWidth: number) {
    // 58 units = 100% of screen width (60 is too wide, it overflows)
    return (percentWidth * 58) / 100;
}

const positionItemsConfig = {
    maxWidth: toItemWidth(100),
    defaultWidth: toItemWidth(50),
    defaultHeight: 20, // 20 vertical units ~ 50% of viewport height
};

/* Set attributes x, y, width and height for an array of dashboard items */
export function positionItems(items: Array<Item>) {
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

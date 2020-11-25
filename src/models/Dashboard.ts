import _ from "lodash";
import {
    Ref,
    PartialModel,
    D2ReportTable,
    D2Chart,
    PartialPersistedModel,
    D2DashboardItem,
    Id,
} from "../types/d2-api";
import { Maybe } from "../types/utils";
import { getUid } from "../utils/dhis2";
import { D2Sharing } from "./ProjectSharing";

export const dimensions = {
    period: { id: "pe" },
    orgUnit: { id: "ou" },
    data: { id: "dx" },
};

export interface Dimension {
    id: string;
    categoryOptions?: Ref[];
}

interface Item {
    id: Id;
    type: "DATA_ELEMENT" | "INDICATOR";
}

export interface Table {
    key: string;
    name: string;
    items: Item[];
    periods: string[];
    relativePeriods?: D2ReportTable["relativePeriods"];
    organisationUnits: Ref[];
    reportFilter: Dimension[];
    rowDimensions: Dimension[];
    columnDimensions: Dimension[];
    rowTotals?: boolean;
    sharing: D2Sharing;
    extra?: PartialModel<D2ReportTable>;
}

export interface Chart {
    key: string;
    name: string;
    items: Item[];
    periods: string[];
    relativePeriods?: D2Chart["relativePeriods"];
    organisationUnits: Ref[];
    reportFilter: Dimension[];
    seriesDimension?: Dimension;
    categoryDimension: Dimension;
    sharing: D2Sharing;
    extra?: PartialModel<D2Chart>;
}

export type MaybeD2Table = Maybe<PartialPersistedModel<D2ReportTable>>;

export type MaybeD2Chart = Maybe<PartialPersistedModel<D2Chart>>;

type DimensionItem =
    | { dataDimensionItemType: "DATA_ELEMENT"; dataElement: Ref }
    | { dataDimensionItemType: "INDICATOR"; indicator: Ref };

export function getDataDimensionItems(items: Item[]): DimensionItem[] {
    return _(items)
        .map(item => {
            if (item.type === "DATA_ELEMENT") {
                return {
                    dataDimensionItemType: "DATA_ELEMENT" as const,
                    dataElement: { id: item.id },
                };
            } else if (item.type === "INDICATOR") {
                return { dataDimensionItemType: "INDICATOR" as const, indicator: { id: item.id } };
            } else {
                console.error(`Unsupported item: ${item.id}`);
                return null;
            }
        })
        .compact()
        .value();
}

export function getD2ReportTable(table: Table): MaybeD2Table {
    if (_.isEmpty(table.items)) return null;

    const dataDimensionItems = getDataDimensionItems(table.items);
    const categoryDimensions = _.concat(
        table.columnDimensions,
        table.rowDimensions,
        table.reportFilter
    );

    const d2Table: PartialPersistedModel<D2ReportTable> = {
        id: getUid(table.key, ""),
        name: table.name,
        numberType: "VALUE",
        legendDisplayStyle: "FILL",
        rowSubTotals: true,
        showDimensionLabels: true,
        aggregationType: "DEFAULT",
        legendDisplayStrategy: "FIXED",
        rowTotals: table.rowTotals ?? true,
        digitGroupSeparator: "SPACE",
        dataDimensionItems,
        organisationUnits: table.organisationUnits,
        periods: table.periods.map(id => ({ id })),
        relativePeriods: table.relativePeriods,
        columns: table.columnDimensions,
        columnDimensions: table.columnDimensions.map(dimension => dimension.id),
        filters: table.reportFilter,
        filterDimensions: table.reportFilter.map(dimension => dimension.id),
        rows: table.rowDimensions,
        rowDimensions: table.rowDimensions.map(dimension => dimension.id),
        categoryDimensions: getCategoryDimensions(categoryDimensions),
        ...table.sharing,
    };

    return _.merge({}, d2Table, table.extra || {});
}

export function getD2Chart(chart: Chart): MaybeD2Chart {
    if (_.isEmpty(chart.items)) return null;
    const dataDimensionItems = getDataDimensionItems(chart.items);
    const seriesDimension = chart.seriesDimension || dimensions.data;

    const chartDimensions = _.compact([
        ...chart.reportFilter,
        chart.seriesDimension,
        chart.categoryDimension,
    ]);

    const d2Chart: PartialPersistedModel<D2Chart> = {
        id: getUid(chart.key, ""),
        name: chart.name,
        periods: chart.periods.map(id => ({ id })),
        relativePeriods: chart.relativePeriods,
        type: "COLUMN",
        aggregationType: "DEFAULT",
        showData: true,
        category: chart.categoryDimension.id,
        series: seriesDimension.id,
        columns: [seriesDimension],
        dataDimensionItems,
        rows: [chart.categoryDimension],
        filters: chart.reportFilter,
        filterDimensions: chart.reportFilter.map(dimension => dimension.id),
        categoryDimensions: getCategoryDimensions(chartDimensions),
        organisationUnits: chart.organisationUnits,
        ...chart.sharing,
    };

    return { ...d2Chart, ...chart.extra };
}

export function getCategoryDimensions(dimensions: Dimension[]) {
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
type DashboardItem = PartialModel<D2DashboardItem>;

export function toItemWidth(percentWidth: number) {
    // 58 units = 100% of screen width (60 is too wide, it overflows)
    return (percentWidth * 58) / 100;
}

export interface PositionItemsOptions {
    maxWidth: number;
    defaultWidth: number;
    defaultHeight: number; // 20 vertical units ~ 50% of viewport height
}

/* Set attributes x, y, width and height for an array of dashboard items */
export function positionItems(items: DashboardItem[], options: PositionItemsOptions) {
    const { maxWidth, defaultWidth, defaultHeight } = options;
    const initialPos = { x: 0, y: 0 };

    return items.reduce<{ pos: Pos; outputItems: DashboardItem[] }>(
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

export function dataElementItems(dataElements: Ref[]): Item[] {
    return dataElements.map(de => ({ type: "DATA_ELEMENT", id: de.id }));
}

export function indicatorItems(indicators: Ref[]): Item[] {
    return indicators.map(indicator => ({ type: "INDICATOR", id: indicator.id }));
}

import _ from "lodash";
import {
    Ref,
    PartialModel,
    PartialPersistedModel,
    D2DashboardItem,
    Id,
    D2Visualization,
} from "../types/d2-api";
import { Maybe } from "../types/utils";
import { getUid, getRefs } from "../utils/dhis2";
import { D2Sharing } from "./Sharing";

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

export interface VisualizationDefinition {
    type: "chart" | "table";
    key: string;
    name: string;
    items: Item[];
    rows: Dimension[];
    columns: Dimension[];
    filters: Dimension[];
    toDate?: boolean;
    rowTotals?: boolean;
    extra?: PartialModel<D2Visualization>;
}

export interface Visualization extends VisualizationDefinition {
    periods: string[];
    relativePeriods?: D2Visualization["relativePeriods"];
    organisationUnits: Ref[];
    sharing: Partial<D2Sharing>;
}

export type MaybeD2Visualization = Maybe<PartialPersistedModel<D2Visualization>>;

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

export function getD2Visualization(visualization: Visualization): MaybeD2Visualization {
    if (_.isEmpty(visualization.items)) return null;

    const dataDimensionItems = getDataDimensionItems(visualization.items);
    const categoryDimensions = _.concat(
        visualization.columns,
        visualization.rows,
        visualization.filters
    );

    const d2Table: PartialPersistedModel<D2Visualization> = {
        id: getUid(visualization.key, ""),
        type: visualization.type === "table" ? "PIVOT_TABLE" : "COLUMN",
        name: visualization.name,
        numberType: "VALUE",
        legendDisplayStyle: "FILL",
        rowSubTotals: true,
        showDimensionLabels: true,
        aggregationType: "DEFAULT",
        legendDisplayStrategy: "FIXED",
        rowTotals: visualization.rowTotals ?? true,
        digitGroupSeparator: "SPACE",
        dataDimensionItems,
        organisationUnits: getRefs(visualization.organisationUnits),
        periods: getPeriods(visualization),
        relativePeriods: visualization.relativePeriods,
        columns: visualization.columns,
        columnDimensions: visualization.columns.map(dimension => dimension.id),
        filters: visualization.filters,
        filterDimensions: visualization.filters.map(dimension => dimension.id),
        rows: visualization.rows,
        rowDimensions: visualization.rows.map(dimension => dimension.id),
        categoryDimensions: getCategoryDimensions(categoryDimensions),
        ...visualization.sharing,
    };

    return _.merge({}, d2Table, visualization.extra || {});
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
    reportTable: MaybeD2Visualization,
    dashboardItemAttributes?: PartialModel<D2DashboardItem>
) {
    if (!reportTable) return null;
    return {
        id: getUid("dashboardItem", reportTable.id),
        type: "REPORT_TABLE" as const,
        visualization: { id: reportTable.id },
        ...(dashboardItemAttributes || {}),
    };
}

export function getChartDashboardItem(
    chart: MaybeD2Visualization,
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

function getPeriods(visualization: Visualization): Ref[] {
    return visualization.periods.map(id => ({ id }));
}

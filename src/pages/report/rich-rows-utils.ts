import _ from "lodash";
import { Ref } from "../../types/d2-api";
import { Maybe } from "../../types/utils";

export type RowComponent<Row> = React.FC<{ row: Row; rowSpan?: number }>;

export interface Grouper<Row> {
    name: string;
    getId: (row: Row) => string;
    component: RowComponent<Row>;
}

type Cells<Row> = Array<Maybe<RichCell<Row>>>;

export interface RichRow<Row> {
    id: string;
    cells: Cells<Row>;
}

export interface RichCell<Row> {
    id: string;
    rowSpan?: number;
    row: Row;
    component: RowComponent<Row>;
}

interface Item<Row> {
    row: Row;
    id: string;
    component: RowComponent<Row>;
}
export function getRichRows<Row extends Ref>(
    rows: Row[],
    groupers: Grouper<Row>[]
): RichRow<Row>[] {
    return _(rows)
        .map(row => getItemsFromRow(row, groupers))
        .unzip()
        .map(getCellsFromItems)
        .unzip()
        .map(getRichRowFromCells)
        .value();
}

function getRichRowFromCells<Row>(cells: Cells<Row>): RichRow<Row> {
    return { id: cells.map(cell => cell?.id || "").join("-"), cells };
}

function getItemsFromRow<Row>(row: Row, groupers: Grouper<Row>[]): Item<Row>[] {
    return groupers.map(grouper => ({
        row,
        id: grouper.getId(row),
        component: grouper.component,
    }));
}

function getCellsFromItems<Row>(items: Item<Row>[]) {
    return _(items)
        .groupConsecutiveBy(item => item.id)
        .flatMap(([_key, items]) => {
            const item = items[0];
            const cell: RichCell<Row> = {
                id: item.id,
                row: item.row,
                rowSpan: items.length > 1 ? items.length : undefined,
                component: item.component,
            };
            return [cell, ..._.fill(Array(items.length - 1), null)];
        })
        .value();
}

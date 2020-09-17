import React, { ReactElement } from "react";
import { TableRow, TableBody, makeStyles } from "@material-ui/core";
import { Ref } from "../../types/d2-api";
import { getRichRows, Grouper } from "./rich-rows-utils";

/* Render a Material-UI table rows with rows grouping (use rowSpan) */

export interface RowProps<Row extends Ref> {
    rows: Row[];
    groupers: Grouper<Row>[];
}

export default function TableBodyGrouped<Row extends Ref>(props: RowProps<Row>): ReactElement {
    const { rows, groupers } = props;
    const classes = useStyles();
    const groupedRows = React.useMemo(() => getRichRows(rows, groupers), [rows, groupers]);

    return (
        <TableBody>
            {groupedRows.map(groupedRow => (
                <TableRow className={classes.row} key={groupedRow.id}>
                    {groupedRow.cells.map(
                        cell =>
                            cell && (
                                <cell.component
                                    key={cell.id}
                                    row={cell.row}
                                    rowSpan={cell.rowSpan}
                                />
                            )
                    )}
                </TableRow>
            ))}
        </TableBody>
    );
}

const useStyles = makeStyles({
    row: {
        borderBottom: "3px solid #E0E0E0",
    },
});

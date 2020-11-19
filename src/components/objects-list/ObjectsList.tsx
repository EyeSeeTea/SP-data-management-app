import React, { PropsWithChildren } from "react";
import {
    ObjectsTable,
    TableColumn,
    TableSorting,
    ReferenceObject,
    PaginationOptions,
    TablePagination,
    TableState,
    ObjectsTableProps,
    TableGlobalAction,
} from "d2-ui-components";
import { makeStyles, LinearProgress } from "@material-ui/core";
import { Spinner } from "../objects-list/Spinner";

export interface ObjectsListProps<Obj extends ReferenceObject> {
    isLoading: boolean;
    rows: Obj[] | undefined;
    columns: TableColumn<Obj>[];
    pagination: Partial<TablePagination>;
    paginationOptions: Partial<PaginationOptions>;
    initialSorting: TableSorting<Obj>;
    onChange(newState: TableState<Obj>): void;
    sideComponents?: ObjectsTableProps<Obj>["sideComponents"];
    globalActions?: TableGlobalAction[];
}

export function ObjectsList<T extends ReferenceObject>(
    props: PropsWithChildren<ObjectsListProps<T>>
): React.ReactElement<ObjectsListProps<T>> {
    const { children, isLoading, rows, ...tableProps } = props;
    const classes = useStyles();
    console.log(rows);

    return (
        <div className={classes.wrapper}>
            {isLoading ? <span data-test-loading /> : <span data-test-loaded />}
            {!rows && <LinearProgress />}
            {rows && (
                <ObjectsTable<T>
                    rows={rows}
                    {...tableProps}
                    filterComponents={
                        <React.Fragment key="filters">
                            {children}

                            <Spinner isVisible={isLoading} />
                        </React.Fragment>
                    }
                />
            )}
        </div>
    );
}

const useStyles = makeStyles({
    wrapper: { marginTop: 25 },
});

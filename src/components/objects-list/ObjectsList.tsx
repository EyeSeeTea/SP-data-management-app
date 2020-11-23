import React, { PropsWithChildren } from "react";
import classnames from "classnames";
import {
    TableColumn,
    TableSorting,
    ReferenceObject,
    PaginationOptions,
    TablePagination,
    TableState,
    ObjectsTableProps,
    TableGlobalAction,
    MouseActionsMapping,
    ObjectsTable,
} from "d2-ui-components";
import { makeStyles } from "@material-ui/core";
import { Spinner } from "../objects-list/Spinner";

export interface ObjectsListProps<Obj extends ReferenceObject> {
    className?: string;
    columns: TableColumn<Obj>[];
    rows: Obj[] | undefined;
    onChange(newState: TableState<Obj>): void;

    isLoading: boolean;

    pagination: Partial<TablePagination>;
    paginationOptions: Partial<PaginationOptions>;
    initialSorting: TableSorting<Obj>;

    sideComponents?: ObjectsTableProps<Obj>["sideComponents"];
    globalActions?: TableGlobalAction[];
    mouseActionsMapping?: MouseActionsMapping;

    searchBoxLabel: string;
    onChangeSearch?(value: string): void;

    reload(): void;
}

export function ObjectsList<T extends ReferenceObject>(
    props: PropsWithChildren<ObjectsListProps<T>>
): React.ReactElement<ObjectsListProps<T>> {
    const {
        className,
        children,
        isLoading,
        rows,
        mouseActionsMapping = defaultMouseActionsMapping,
        ...tableProps
    } = props;

    const classes = useStyles();

    return (
        <div className={classnames(classes.wrapper, className)}>
            {isLoading ? <span data-test-loading /> : <span data-test-loaded />}
            {
                <ObjectsTable<T>
                    rows={rows || []}
                    mouseActionsMapping={mouseActionsMapping}
                    {...tableProps}
                    filterComponents={
                        <React.Fragment key="filters">
                            {children}

                            <Spinner isVisible={isLoading} />
                        </React.Fragment>
                    }
                />
            }
        </div>
    );
}

const defaultMouseActionsMapping: MouseActionsMapping = {
    left: { type: "contextual" },
    right: { type: "contextual" },
};

const useStyles = makeStyles({
    wrapper: { marginTop: 25 },
});

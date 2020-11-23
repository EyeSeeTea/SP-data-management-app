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
    MouseActionsMapping,
} from "d2-ui-components";
import { makeStyles } from "@material-ui/core";
import { Spinner } from "../objects-list/Spinner";
import styled from "styled-components";

export interface ObjectsListProps<Obj extends ReferenceObject> {
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

const ObjectsTableStyled = styled(ObjectsTable)`
    .MuiTextField-root {
        max-width: 250px;
    }
`;

export function ObjectsList<T extends ReferenceObject>(
    props: PropsWithChildren<ObjectsListProps<T>>
): React.ReactElement<ObjectsListProps<T>> {
    const {
        children,
        isLoading,
        rows,
        mouseActionsMapping = defaultMouseActionsMapping,
        ...tableProps
    } = props;

    const classes = useStyles();

    return (
        <div className={classes.wrapper}>
            {isLoading ? <span data-test-loading /> : <span data-test-loaded />}
            {
                <ObjectsTableStyled<React.FC<ObjectsTableProps<T>>>
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

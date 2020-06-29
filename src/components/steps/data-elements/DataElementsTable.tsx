import React, { useState, useEffect, useMemo, ReactNode } from "react";
import { ObjectsTable, useSnackbar, RowConfig } from "d2-ui-components";
import { TablePagination, TableColumn, TableState, TableSorting } from "d2-ui-components";
import _ from "lodash";

import DataElementsFilters, { Filter } from "./DataElementsFilters";
import i18n from "../../../locales";
import DataElementsSet, { SelectionInfo, DataElement } from "../../../models/dataElementsSet";
import { Tooltip } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Id } from "../../../types/d2-api";

export interface DataElementsTableProps {
    dataElementsSet: DataElementsSet;
    sectorId: Id;
    onSelectionChange: (dataElementIds: Id[]) => SelectionInfo;
}

const initialPagination: Partial<TablePagination> = {
    pageSize: 50,
    page: 1,
    pageSizeOptions: [10, 20, 50],
};

const initialSorting: TableSorting<DataElement> = {
    field: "series",
    order: "asc" as const,
};

const searchBoxColumns = ["name" as const, "code" as const, "search" as const];

const sortableFields = [
    "name",
    "code",
    "peopleOrBenefit",
    "series",
    "countingMethod",
    "externals",
] as const;
type SortableField = typeof sortableFields[number];

const columns: TableColumn<DataElement>[] = [
    {
        name: "name" as const,
        text: i18n.t("Name"),
        sortable: true,
        getValue: getName,
    },
    {
        name: "code" as const,
        text: i18n.t("Code"),
        sortable: true,
        getValue: withPaired("code"),
    },
    { name: "indicatorType" as const, text: i18n.t("Indicator Type"), sortable: true },
    {
        name: "peopleOrBenefit" as const,
        text: i18n.t("People / Benefit"),
        sortable: true,
        getValue: withPaired("peopleOrBenefit"),
    },
    {
        name: "series" as const,
        text: i18n.t("Series"),
        sortable: true,
        getValue: withPaired("series"),
    },
    {
        name: "countingMethod" as const,
        text: i18n.t("Counting Method"),
        sortable: true,
        getValue: withPaired("countingMethod"),
    },
    {
        name: "externals" as const,
        text: i18n.t("Externals"),
        sortable: true,
        getValue: withPaired("externals", externals => externals.join(", ")),
    },
];

const DataElementsTable: React.FC<DataElementsTableProps> = props => {
    const { dataElementsSet, sectorId, onSelectionChange } = props;
    const snackbar = useSnackbar();
    const [filter, setFilter] = useState<Filter>({});

    useEffect(() => setFilter({}), [sectorId]);

    const fullFilter = { ...filter, sectorId };

    const dataElements = useMemo(() => dataElementsSet.get(fullFilter), [
        dataElementsSet,
        sectorId,
        filter,
    ]);

    const filterOptions = useMemo(() => {
        const dataElements = dataElementsSet.get({ ...filter, sectorId });
        return {
            externals: _.sortBy(_.uniq(_.flatten(dataElements.map(de => de.externals)))),
        };
    }, [dataElementsSet, sectorId]);

    const selection = useMemo(() => {
        return dataElementsSet.get({ onlySelected: true, sectorId }).map(de => ({ id: de.id }));
    }, [dataElementsSet, sectorId]);

    const initialState = useMemo(() => {
        return { pagination: initialPagination, sorting: initialSorting };
    }, [initialPagination, initialSorting]);

    const onChange = React.useCallback(
        (state: TableState<DataElement>) => {
            return onTableChange(onSelectionChange, snackbar, state);
        },
        [onTableChange, onSelectionChange, snackbar]
    );

    const filterComponents = React.useMemo(
        () => (
            <DataElementsFilters
                key="filters"
                filter={filter}
                filterOptions={filterOptions}
                onChange={setFilter}
            />
        ),
        [filter, filterOptions, setFilter]
    );

    const rowConfig = React.useCallback(
        (de: DataElement): RowConfig => ({
            selectable: de.selectable,
            style: de.selectable ? undefined : { backgroundColor: "#F5DFDF" },
        }),
        [dataElements]
    );

    if (!sectorId) return null;

    return (
        <ObjectsTable<DataElement>
            selection={selection}
            rows={dataElements}
            rowConfig={rowConfig}
            forceSelectionColumn={true}
            initialState={initialState}
            columns={columns}
            searchBoxLabel={i18n.t("Search by name / code")}
            onChange={onChange}
            searchBoxColumns={searchBoxColumns}
            resetKey={JSON.stringify(fullFilter)}
            filterComponents={filterComponents}
        />
    );
};

const useStyles = makeStyles(() => ({
    tooltip: {
        maxWidth: 800,
        border: "1px solid #dadde9",
        backgroundColor: "#616161",
    },
    tooltipContents: {
        padding: 2,
        fontSize: "1.5em",
        lineHeight: "1.3em",
        fontWeight: "normal",
    },
}));

function getName(dataElement: DataElement, _value: ReactNode): ReactNode {
    return <NameColumn key={dataElement.name} dataElement={dataElement} />;
}

const NameColumn: React.FC<{ dataElement: DataElement }> = ({ dataElement }) => {
    const dataElements = [dataElement, ...dataElement.pairedDataElements];
    const classes = useStyles();
    const tooltips = renderJoin(
        dataElements.map(dataElement => (
            <Tooltip
                enterDelay={500}
                leaveDelay={0}
                key={dataElement.id}
                title={
                    <div className={classes.tooltipContents}>{getTooltipContents(dataElement)}</div>
                }
                classes={{ tooltip: classes.tooltip }}
            >
                <span>{dataElement.name}</span>
            </Tooltip>
        )),
        <br />
    );

    return <React.Fragment>{tooltips}</React.Fragment>;
};

function getTooltipContents(dataElement: DataElement) {
    const { externalsDescription, description } = dataElement;
    return (
        <React.Fragment>
            <div>
                {dataElement.code} - {dataElement.name}
            </div>
            <br />
            {externalsDescription && (
                <div>
                    <b>{i18n.t("Externals")}: </b>
                    {externalsDescription}
                </div>
            )}
            {description && (
                <div>
                    <b>{i18n.t("Guidance")}: </b>
                    {description}
                </div>
            )}
            ) : null,
        </React.Fragment>
    );
}

function withPaired<Field extends keyof DataElement>(
    field: SortableField & Field,
    mapper?: (val: DataElement[Field]) => string
) {
    const mapper_ = mapper || _.identity;
    const render = function(dataElement: DataElement, _value: ReactNode) {
        const paired = dataElement.pairedDataElements;
        const values = [dataElement, ...paired].map(de => mapper_(de[field]) || "-");
        // <DataTable /> uses the column node key (if present) as sorting key, so let's set it
        // to a value that performs a composite (dataElement[FIELD], dataElement.code) ordering.
        const value = dataElement[field];
        const code = dataElement.code;
        const key = value + "-" + code;
        return <React.Fragment key={key}>{renderJoin(values, <br />)}</React.Fragment>;
    };

    return render;
}

function getSelectionMessage(dataElements: DataElement[], action: string): string | null {
    return dataElements.length === 0
        ? null
        : [
              i18n.t("Those related data elements have been automatically {{action}}:", { action }),
              "",
              ...dataElements.map(de => `[${de.code}] ${de.name} (${de.indicatorType})`),
          ].join("\n");
}

function showSelectionMessage(snackbar: any, selectionUpdate: SelectionInfo): void {
    const msg = _.compact([
        getSelectionMessage(selectionUpdate.selected || [], i18n.t("selected")),
        ...(selectionUpdate.messages || []),
    ]).join("\n\n");

    if (msg) snackbar.info(msg);
}

function onTableChange(
    onSelectionChange: (selectedIds: Id[]) => SelectionInfo,
    snackbar: any,
    state: TableState<DataElement>
): void {
    const selectedIds = state.selection.map(de => de.id);
    const selectionInfo = onSelectionChange(selectedIds);
    if (selectionInfo) showSelectionMessage(snackbar, selectionInfo);
}

function renderJoin(nodes: ReactNode[], separator: ReactNode): ReactNode {
    return _(nodes)
        .compact()
        .flatMap((node, idx) => (idx < nodes.length - 1 ? [node, separator] : [node]))
        .map((node, idx) => <React.Fragment key={idx}>{node || "-"}</React.Fragment>)
        .value();
}

export default React.memo(DataElementsTable);

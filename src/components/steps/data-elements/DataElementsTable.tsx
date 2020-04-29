import React, { useState, useEffect, useMemo, ReactNode } from "react";
import { ObjectsTable, TablePagination, TableColumn, TableState } from "d2-ui-components";
import { useSnackbar } from "d2-ui-components";
import _ from "lodash";
import DataElementsFilters, { Filter } from "./DataElementsFilters";
import i18n from "../../../locales";
import DataElementsSet, { SelectionInfo, DataElement } from "../../../models/dataElementsSet";
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

const DataElementsTable: React.FC<DataElementsTableProps> = props => {
    const { dataElementsSet, sectorId, onSelectionChange } = props;
    const snackbar = useSnackbar();
    const [filter, setFilter] = useState<Filter>({});

    useEffect(() => setFilter({}), [sectorId]);

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

    if (!sectorId) return null;

    return (
        <ObjectsTable<DataElement>
            selection={selection}
            rows={dataElements}
            forceSelectionColumn={true}
            initialState={{ pagination: initialPagination }}
            columns={columns}
            searchBoxLabel={i18n.t("Search by name / code")}
            onChange={state => onTableChange(onSelectionChange, snackbar, state)}
            searchBoxColumns={["name", "code", "search"]}
            resetKey={JSON.stringify(fullFilter)}
            filterComponents={
                <DataElementsFilters
                    key="filters"
                    filter={filter}
                    filterOptions={filterOptions}
                    onChange={setFilter}
                />
            }
        />
    );
};

function getName(dataElement: DataElement, _value: ReactNode): ReactNode {
    const dataElements = [dataElement, ...dataElement.pairedDataElements];

    return renderJoin(
        dataElements.map(de => (
            <span key={de.id} title={de.description}>
                {de.name}
            </span>
        )),
        <br />
    );
}

function withPaired<Field extends keyof DataElement>(
    field: Field,
    mapper?: (val: DataElement[Field]) => string
) {
    const mapper_ = mapper || _.identity;
    const render = (dataElement: DataElement, _value: ReactNode) => {
        const values = [dataElement, ...dataElement.pairedDataElements].map(de =>
            mapper_(de[field])
        );
        return <React.Fragment key={dataElement.name}>{renderJoin(values, <br />)}</React.Fragment>;
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
    return _.flatMap(nodes, (node, idx) =>
        idx < nodes.length - 1 ? [node, separator] : [node]
    ).map((node, idx) => <React.Fragment key={idx}>{node || "-"}</React.Fragment>);
}

export default React.memo(DataElementsTable);

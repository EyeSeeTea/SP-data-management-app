import React, { useState, useEffect, useMemo, ReactNode } from "react";
import { ObjectsTable, TablePagination, TableColumn, TableState } from "d2-ui-components";
import { useSnackbar } from "d2-ui-components";
import _ from "lodash";
import DataElementsFilters, { Filter } from "./DataElementsFilters";
import i18n from "../../../locales";
import DataElementsSet, { SelectionUpdate, DataElement } from "../../../models/dataElementsSet";
import Project from "../../../models/Project";
import { useAppContext } from "../../../contexts/api-context";

type Field = "selection" | "MER";

export interface DataElementsTableProps {
    dataElementsSet: DataElementsSet;
    sectorId?: string;
    project: Project;
    onChange: (project: Project) => void;
    field: Field;
}

const initialPagination: Partial<TablePagination> = {
    pageSize: 10,
    page: 1,
    pageSizeOptions: [10, 20, 50],
};

const DataElementsTable: React.FC<DataElementsTableProps> = props => {
    const { project, dataElementsSet, sectorId, onChange, field } = props;
    const { isDev } = useAppContext();
    const snackbar = useSnackbar();
    const [filter, setFilter] = useState<Filter>({});
    if (!sectorId) return null;

    useEffect(() => setFilter({}), [sectorId]);

    const columns: TableColumn<DataElement>[] = [
        {
            name: "name" as const,
            text: i18n.t("Name"),
            sortable: true,
            getValue: getName(field),
        },
        { name: "code" as const, text: i18n.t("Code"), sortable: true, getValue: getCode },
        { name: "indicatorType" as const, text: i18n.t("Indicator Type"), sortable: true },
        { name: "peopleOrBenefit" as const, text: i18n.t("People / Benefit"), sortable: true },
        {
            name: "countingMethod" as const,
            text: i18n.t("Counting Method"),
            sortable: true,
            getValue: withDefault("countingMethod", "-"),
        },
        {
            name: "externals" as const,
            text: i18n.t("Externals"),
            sortable: true,
            getValue: getExternals,
        },
        ...(isDev ? [{ name: "pairedDataElementCode" as const, text: i18n.t("Paired DE") }] : []),
    ];

    const baseFilter =
        field === "selection"
            ? filter
            : {
                  ...filter,
                  includePaired: true,
                  onlySelected: true,
                  onlyMERSelected: filter.onlySelected,
              };
    const fullFilter = { ...baseFilter, sectorId };

    const dataElements = useMemo(() => dataElementsSet.get(fullFilter), [
        dataElementsSet,
        sectorId,
        field,
        filter,
    ]);

    const filterOptions = useMemo(() => {
        const dataElements = dataElementsSet.get({ ...baseFilter, sectorId });
        return {
            series: _.sortBy(_.uniq(dataElements.map(de => de.series))),
            externals: _.sortBy(_.uniq(_.flatten(dataElements.map(de => de.externals)))),
        };
    }, [dataElementsSet, sectorId]);

    const selection = useMemo(() => {
        const getOpts = field === "selection" ? { onlySelected: true } : { onlyMERSelected: true };
        return dataElementsSet.get({ ...getOpts, sectorId });
    }, [dataElementsSet, sectorId]);

    const searchBoxColumns =
        field === "selection"
            ? [
                  "name" as const,
                  "code" as const,
                  "pairedDataElementName" as const,
                  "pairedDataElementCode" as const,
              ]
            : ["name" as const, "code" as const];

    return (
        <ObjectsTable<DataElement>
            selection={selection}
            rows={dataElements}
            forceSelectionColumn={true}
            initialState={{ pagination: initialPagination }}
            columns={columns}
            searchBoxLabel={i18n.t("Search by name / code")}
            onChange={state => onTableChange(sectorId, field, project, onChange, snackbar, state)}
            searchBoxColumns={searchBoxColumns}
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

function getName(field: Field) {
    const Name = (dataElement: DataElement, _value: ReactNode): ReactNode => {
        return (
            <React.Fragment key={dataElement.name}>
                <span title={dataElement.description}>{dataElement.name}</span>
                {dataElement.pairedDataElement && field === "selection" && (
                    <React.Fragment>
                        <br />
                        <span title={dataElement.pairedDataElement.description}>
                            {dataElement.pairedDataElement.name}
                        </span>
                    </React.Fragment>
                )}
            </React.Fragment>
        );
    };
    return Name;
}

function getCode(dataElement: DataElement, _value: ReactNode) {
    const codes = _.compact([dataElement, dataElement.pairedDataElement]).map(de => de.code);
    return <React.Fragment key={dataElement.name}>{renderJoin(codes, <br />)}</React.Fragment>;
}

function getExternals(dataElement: DataElement, _value: ReactNode) {
    const { externals } = dataElement;
    return <React.Fragment key={externals[0]}>{renderJoin(externals, <br />)}</React.Fragment>;
}

function getRelatedMessage(dataElements: DataElement[], action: string): string | null {
    return dataElements.length === 0
        ? null
        : [
              i18n.t("Those related data elements have been automatically {{action}}:", { action }),
              "",
              ...dataElements.map(de => `${de.name} (${de.indicatorType})`),
          ].join("\n");
}

function showRelatedMessage(snackbar: any, selectionUpdate: SelectionUpdate): void {
    const msg = _.compact([
        getRelatedMessage(selectionUpdate.selected, i18n.t("selected")),
        getRelatedMessage(selectionUpdate.unselected, i18n.t("unselected")),
    ]).join("\n\n");

    if (msg) snackbar.info(msg);
}

function onTableChange(
    sectorId: string,
    field: Field,
    project: Project,
    onChange: (project: Project) => void,
    snackbar: any,
    state: TableState<DataElement>
): void {
    const dataElementIds = state.selection.map(de => de.id);

    if (field === "selection") {
        const { related, project: projectUpdated } = project.updateDataElementsSelectionForSector(
            dataElementIds,
            sectorId
        );

        showRelatedMessage(snackbar, related);
        onChange(projectUpdated);
    } else {
        const projectUpdated = project.updateDataElementsMERSelectionForSector(
            dataElementIds,
            sectorId
        );
        onChange(projectUpdated);
    }
}

function renderJoin(nodes: ReactNode[], separator: ReactNode): ReactNode {
    return _.flatMap(nodes, (node, idx) =>
        idx < nodes.length - 1 ? [node, separator] : [node]
    ).map((node, idx) => <React.Fragment key={idx}>{node}</React.Fragment>);
}

function withDefault(key: keyof DataElement, defaultValue: string) {
    return (dataElement: DataElement, _value: ReactNode) => {
        return dataElement[key] || defaultValue;
    };
}

export default DataElementsTable;

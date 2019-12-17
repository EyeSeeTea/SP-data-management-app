import React, { useState, useEffect, useMemo } from "react";
import { ObjectsTable, TablePagination, TableColumn } from "d2-ui-components";
import { useSnackbar } from "d2-ui-components";
import _ from "lodash";
import DataElementsFilters, { Filter } from "./DataElementsFilters";
import i18n from "../../../locales";
import DataElementsSet, { SelectionUpdate, DataElement } from "../../../models/dataElementsSet";
import Project from "../../../models/Project";

type Field = "selection" | "MER";

export interface DataElementsTableProps {
    dataElementsSet: DataElementsSet;
    sectorId?: string;
    project: Project;
    onChange: (project: Project) => void;
    field: Field;
}

const DataElementsTable: React.FC<DataElementsTableProps> = props => {
    const { project, dataElementsSet, sectorId, onChange, field } = props;
    const snackbar = useSnackbar();
    const [filter, setFilter] = useState<Filter>({});
    if (!sectorId) return null;

    useEffect(() => setFilter({}), [sectorId]);

    const columns: TableColumn<DataElement>[] = [
        {
            name: "name" as const,
            text: i18n.t("Name"),
            sortable: true,
            getValue: (dataElement: DataElement) => getName(field, dataElement),
        },
        { name: "code" as const, text: i18n.t("Code"), sortable: true },
        { name: "indicatorType" as const, text: i18n.t("Indicator Type"), sortable: true },
        { name: "peopleOrBenefit" as const, text: i18n.t("People / Benefit"), sortable: true },
        { name: "series" as const, text: i18n.t("Series"), sortable: true },
        // { name: "pairedDataElementCode" as const, text: i18n.t("Paired DE"), sortable: true },
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

    const filterOptions = useMemo(
        () => ({
            series: _.sortBy(
                _.uniq(dataElementsSet.get({ ...baseFilter, sectorId }).map(de => de.series))
            ),
        }),
        [dataElementsSet, sectorId]
    );

    const pagination: TablePagination = { pageSize: 25, page: 1, total: dataElements.length };

    const componentKey = _(fullFilter)
        .map((value, key) => `${key}=${value || ""}`)
        .join("-");

    const selection = useMemo(() => {
        const getOpts = field === "selection" ? { onlySelected: true } : { onlyMERSelected: true };
        return dataElementsSet.get({ ...getOpts, sectorId }).map(de => de.id);
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
            initialState={{ pagination }}
            columns={columns}
            searchBoxLabel={i18n.t("Search by name / code")}
            onChange={state =>
                onSelectionChange(sectorId, field, project, onChange, snackbar, state.selection)
            }
            searchBoxColumns={searchBoxColumns}
            key={componentKey}
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

function getName(field: Field, dataElement: DataElement) {
    return (
        <React.Fragment>
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

function onSelectionChange(
    sectorId: string,
    field: Field,
    project: Project,
    onChange: (project: Project) => void,
    snackbar: any,
    dataElementIds: string[]
): void {
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

export default DataElementsTable;

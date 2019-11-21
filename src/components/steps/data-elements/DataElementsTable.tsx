import React, { useState, useEffect, useMemo } from "react";
import { ObjectsTable, TablePagination, TableColumn } from "d2-ui-components";
import _ from "lodash";
import i18n from "../../../locales";
import DataElementsSet, { DataElement } from "../../../models/dataElementsSet";
import DataElementsFilters, { Filter } from "./DataElementsFilters";

interface DataElementsTableProps {
    dataElementsSet: DataElementsSet;
    sectorId?: string;
    onSelectionChange: (dataElementIds: string[]) => void;
}

const DataElementsTable: React.FC<DataElementsTableProps> = props => {
    const { dataElementsSet, sectorId, onSelectionChange } = props;
    const [filter, setFilter] = useState<Filter>({});

    useEffect(() => setFilter({}), [sectorId]);

    const columns: TableColumn<DataElement>[] = [
        { name: "name" as const, text: i18n.t("Name"), sortable: true },
        { name: "code" as const, text: i18n.t("Code"), sortable: true },
        { name: "indicatorType" as const, text: i18n.t("Indicator Type"), sortable: true },
        { name: "peopleOrBenefit" as const, text: i18n.t("People / Benefit"), sortable: true },
        { name: "series" as const, text: i18n.t("Series"), sortable: true },
        // { name: "pairedDataElementCode" as const, text: i18n.t("Paired DE"), sortable: true },
    ];

    const fullFilter = { ...filter, sectorId };

    const dataElements = useMemo(() => dataElementsSet.get(fullFilter), [
        dataElementsSet,
        sectorId,
        filter,
    ]);

    const filterOptions = useMemo(
        () => ({
            series: _.sortBy(_.uniq(dataElementsSet.get({ sectorId }).map(de => de.series))),
        }),
        [dataElementsSet, sectorId]
    );

    const pagination: TablePagination = { pageSize: 10, page: 1, total: dataElements.length };

    const componentKey = _(fullFilter)
        .map((value, key) => `${key}=${value || ""}`)
        .join("-");

    const selection = useMemo(() => dataElementsSet.getSelected({ sectorId }).map(de => de.id), [
        dataElementsSet,
        sectorId,
    ]);

    return (
        <ObjectsTable<DataElement>
            selection={selection}
            rows={dataElements}
            forceSelectionColumn={true}
            initialState={{ pagination }}
            columns={columns}
            searchBoxLabel={i18n.t("Search by name / code")}
            onChange={state => onSelectionChange(state.selection)}
            searchBoxColumns={["name", "code"]}
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

export default DataElementsTable;

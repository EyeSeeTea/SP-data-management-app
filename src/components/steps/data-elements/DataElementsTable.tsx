import React, { useState, useEffect } from "react";
import { ObjectsTable, TablePagination, TableColumn } from "d2-ui-components";
import _ from "lodash";
import i18n from "../../../locales";
import DataElementsSet, { DataElement, indicatorTypes } from "../../../models/dataElementsSet";
import DataElementsFilters, { Filter } from "./DataElementsFilters";

interface DataElementsTableProps {
    dataElementsSet: DataElementsSet;
    sectorId?: string;
    onSelectionChange: (dataElementIds: string[]) => void;
}

const DataElementsTable: React.FC<DataElementsTableProps> = props => {
    const { dataElementsSet, sectorId, onSelectionChange } = props;

    const [currentFilter, setCurrentFilter] = useState<Filter>({});
    useEffect(() => setCurrentFilter({}), [sectorId]);

    const columns: TableColumn<DataElement>[] = [
        { name: "name" as const, text: i18n.t("Name"), sortable: true },
        { name: "code" as const, text: i18n.t("Code"), sortable: true },
        { name: "indicatorType" as const, text: i18n.t("Indicator Type"), sortable: true },
        { name: "peopleOrBenefit" as const, text: i18n.t("People / Benefit"), sortable: true },
        { name: "series" as const, text: i18n.t("Series"), sortable: true },
        // { name: "pairedDataElementCode" as const, text: i18n.t("Paired DE"), sortable: true },
    ];

    const filter = {
        sectorId,
        series: currentFilter.series,
        indicatorType: currentFilter.indicatorType,
        onlySelected: currentFilter.onlySelected,
    };
    const dataElements = dataElementsSet.get(filter);

    const filterOptions = React.useMemo(() => {
        const dataElements = dataElementsSet.get({ sectorId });
        return {
            series: _.sortBy(_.uniq(dataElements.map(de => de.series))),
            indicatorType: indicatorTypes,
        };
    }, [dataElementsSet, sectorId]);

    const pagination: TablePagination = { pageSize: 10, page: 1, total: dataElements.length };

    const componentKey = _(filter)
        .map((value, key) => `${key}=${value || ""}`)
        .join("-");

    return (
        <ObjectsTable<DataElement>
            selection={dataElementsSet.selected}
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
                    filter={currentFilter}
                    filterOptions={filterOptions}
                    onChange={setCurrentFilter}
                />
            }
        />
    );
};

export default DataElementsTable;

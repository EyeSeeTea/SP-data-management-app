import { ObjectsTable, TablePagination, TableColumn, TableState } from "d2-ui-components";
import React from "react";
import i18n from "../../../locales";
import DataElementsSet, { DataElement } from "../../../models/dataElementsSet";

interface DataElementsTableProps {
    dataElements: DataElementsSet;
    sectorId?: string;
    onSelectionChange: (dataElementIds: string[]) => void;
}

const DataElementsTable: React.FC<DataElementsTableProps> = props => {
    const { dataElements, sectorId, onSelectionChange } = props;

    const columns: TableColumn<DataElement>[] = [
        { name: "name" as const, text: i18n.t("Name"), sortable: true },
        { name: "code" as const, text: i18n.t("Code"), sortable: true },
        { name: "indicatorType" as const, text: i18n.t("Indicator Type"), sortable: true },
        { name: "peopleOrBenefit" as const, text: i18n.t("People / Benefit"), sortable: true },
        { name: "series" as const, text: i18n.t("Series"), sortable: true },
        // { name: "pairedDataElementCode" as const, text: i18n.t("Paired DE"), sortable: true },
    ];

    const rows = dataElements.get({ sectorId });
    const selection = dataElements.selected;
    const pagination: TablePagination = { pageSize: 10, page: 1, total: rows.length };

    return (
        <ObjectsTable<DataElement>
            selection={selection}
            rows={rows}
            forceSelectionColumn={true}
            initialState={{ pagination }}
            columns={columns}
            searchBoxLabel={i18n.t("Search by name / code")}
            onChange={state => onSelectionChange(state.selection)}
            searchBoxColumns={["name", "code"]}
        />
    );
};

export default DataElementsTable;

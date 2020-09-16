import React from "react";
import _ from "lodash";
import { ProjectForMer, DataElementInfo, DataElementMER } from "../../models/MerReport";
import { TableCell } from "@material-ui/core";
import TextFieldOnBlur from "./TextFieldOnBlur";
import { getMultilineRows } from "./utils";
import i18n from "../../locales";

interface DataElementCellsProps {
    dataElement: DataElementMER;
    onChange(project: ProjectForMer, dataElement: DataElementInfo, value: string): void;
}

const DataElementCells: React.FC<DataElementCellsProps> = props => {
    const { dataElement, onChange } = props;
    return (
        <React.Fragment>
            <TableCell>{getDataElementName(dataElement)}</TableCell>
            <TableCell>{formatNumber(dataElement.target)}</TableCell>
            <TableCell>{formatNumber(dataElement.actual)}</TableCell>
            <TableCell>{formatNumber(dataElement.targetAchieved)}</TableCell>
            <TableCell>{formatNumber(dataElement.actualAchieved)}</TableCell>
            <TableCell>{formatNumber(dataElement.achieved, "%")}</TableCell>
            <TableCell>
                <TextFieldOnBlur
                    value={dataElement.comment}
                    fullWidth={true}
                    multiline={true}
                    rows={getMultilineRows(dataElement.comment, 1, 4)}
                    rowsMax={4}
                    onBlurChange={value => onChange(dataElement.project, dataElement, value)}
                />
            </TableCell>
        </React.Fragment>
    );
};

function formatNumber(n: number | null | undefined, suffix?: string): string {
    return n === null || n === undefined ? "-" : n.toFixed(2) + (suffix || "");
}

function getDataElementName(dataElement: DataElementMER): string {
    const parts = [dataElement.name, dataElement.isCovid19 ? i18n.t("[COVID-19]") : null];
    return _.compact(parts).join(" ");
}

export default React.memo(DataElementCells);

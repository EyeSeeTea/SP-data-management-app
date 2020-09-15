import React from "react";
import { ProjectForMer, DataElementInfo, DataElementMER } from "../../models/MerReport";
import { TableCell } from "@material-ui/core";
import TextFieldOnBlur from "./TextFieldOnBlur";
import { getMultilineRows } from "./utils";

interface DataElementCellsProps {
    dataElement: DataElementMER;
    onChange(project: ProjectForMer, dataElement: DataElementInfo, value: string): void;
}

const DataElementCells: React.FC<DataElementCellsProps> = props => {
    const { dataElement, onChange } = props;
    return (
        <React.Fragment>
            <TableCell>{dataElement.name}</TableCell>
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

export default React.memo(DataElementCells);

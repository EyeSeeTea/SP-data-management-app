import React from "react";
import _ from "lodash";
import {
    ProjectForMer,
    DataElementInfo,
    DataElementMER,
    MaybeDataValue,
} from "../../models/MerReport";
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
            <TableCell>{formatDataNumber(dataElement.target)}</TableCell>
            <TableCell>{formatDataNumber(dataElement.actual)}</TableCell>
            <TableCell>{formatDataNumber(dataElement.targetAchieved)}</TableCell>
            <TableCell>{formatDataNumber(dataElement.actualAchieved)}</TableCell>
            <TableCell>
                {formatDataNumber(dataElement.achieved, { suffix: "%", decimals: 0 })}
            </TableCell>
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

interface FormatNumberOptions {
    decimals?: number;
    suffix?: string;
}

function removeTrailingZeros(s: string): string {
    return s.includes(".") ? s.replace(/\.0+$/, "") : s;
}

function formatNumber(n: number | null | undefined, options: FormatNumberOptions = {}): string {
    const { suffix, decimals = 3 } = options;
    return _.isNil(n) ? "-" : removeTrailingZeros(n.toFixed(decimals)) + (suffix || "");
}

function formatDataNumber(dataValue: MaybeDataValue, options: FormatNumberOptions = {}): string {
    const onlyApproved = formatNumber(dataValue.onlyApproved, options);
    const all = formatNumber(dataValue.all, options);
    return `${onlyApproved} / ${all}`;
}

function getDataElementName(dataElement: DataElementMER): string {
    const parts = [dataElement.name, dataElement.isCovid19 ? i18n.t("[COVID-19]") : null];
    return _.compact(parts).join(" ");
}

export default React.memo(DataElementCells);

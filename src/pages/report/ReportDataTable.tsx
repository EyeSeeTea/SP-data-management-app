import React from "react";
import { Table, TableRow, TableHead, TableCell, Paper } from "@material-ui/core";

import MerReport, { DataElementInfo, ProjectForMer, DataElementMER } from "../../models/MerReport";
import i18n from "../../locales";
import TableBodyGrouped from "./TableBodyGrouped";
import { Grouper, RowComponent } from "./rich-rows-utils";
import DataElementCells from "./DataElementCells";

interface ReportDataTableProps {
    merReport: MerReport;
    onChange(merReport: MerReport): void;
}

const ReportDataTable: React.FC<ReportDataTableProps> = props => {
    const { merReport, onChange } = props;
    const { date, organisationUnit } = merReport.data;

    const onCommentChange = React.useCallback(
        (project: ProjectForMer, dataElement: DataElementInfo, comment: string): void => {
            if (merReport) onChange(merReport.setComment(project, dataElement, comment));
        },
        [merReport]
    );

    const groupers: Grouper<DataElementMER>[] = React.useMemo(() => {
        return [
            {
                name: "locations",
                getId: dataElementMER =>
                    dataElementMER.locations.map(location => location.id).join("+"),
                component: LocationCell,
            },
            {
                name: "project",
                getId: dataElementMER => dataElementMER.project.id,
                component: ProjectCell,
            },
            {
                name: "indicator",
                getId: dataElementMER => [dataElementMER.project.id, dataElementMER.id].join("-"),
                component: function DataElementCellsForIndicator({ row: dataElementMER }) {
                    return (
                        <DataElementCells dataElement={dataElementMER} onChange={onCommentChange} />
                    );
                },
            },
        ];
    }, [onCommentChange]);

    const rows = React.useMemo(() => merReport.getData(), [merReport]);

    if (!date || !organisationUnit) return null;

    return (
        <Paper>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell style={w("15em")}>{i18n.t("Locations")}</TableCell>
                        <TableCell style={w("15em")}>{i18n.t("Project")}</TableCell>
                        <TableCell style={w("35em")}>{i18n.t("Indicators")}</TableCell>
                        <TableCell style={w("3em")}>{i18n.t("Target")}</TableCell>
                        <TableCell style={w("3em")}>{i18n.t("Actual")}</TableCell>
                        <TableCell style={w("4em")}>{i18n.t("Target to date")}</TableCell>
                        <TableCell style={w("4em")}>{i18n.t("Actual to date")}</TableCell>
                        <TableCell style={w("5em")}> {i18n.t("Achieved to date (%)")}</TableCell>
                        <TableCell style={w("30em")}>{i18n.t("Comment")}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBodyGrouped rows={rows} groupers={groupers} />
            </Table>
        </Paper>
    );
};

function w<Value extends number | string>(value: Value): { width: Value } {
    return { width: value };
}

const LocationCell: RowComponent<DataElementMER> = props => {
    const { row: dataElementMER, rowSpan } = props;
    return (
        <TableCell rowSpan={rowSpan}>
            {dataElementMER.locations.map(location => location.name).join(", ")}
        </TableCell>
    );
};

const ProjectCell: RowComponent<DataElementMER> = props => {
    const { row: dataElementMER, rowSpan } = props;

    return (
        <TableCell rowSpan={rowSpan}>
            {dataElementMER.project.name}
            <br />
            <i>{dataElementMER.project.dateInfo}</i>
        </TableCell>
    );
};

function shouldKeepView(prevProps: ReportDataTableProps, nextProps: ReportDataTableProps): boolean {
    return prevProps.merReport.data.projectsData === nextProps.merReport.data.projectsData;
}

export default React.memo(ReportDataTable, shouldKeepView);

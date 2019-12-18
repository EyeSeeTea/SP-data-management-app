import React from "react";
import {
    Table,
    TableRow,
    TableHead,
    TableCell,
    TableBody,
    Paper,
    LinearProgress,
} from "@material-ui/core";

import MerReport, { DataElementInfo, Project } from "../../models/MerReport";
import i18n from "../../locales";
import { getMultilineRows } from "./utils";
import TextFieldOnBlur from "./TextFieldOnBlur";

interface ReportDataTableProps {
    merReport: MerReport;
    onChange(merReport: MerReport): void;
}

const ReportDataTable: React.FC<ReportDataTableProps> = props => {
    const { merReport, onChange } = props;
    const { date, organisationUnit } = merReport.data;
    if (!date || !organisationUnit) return null;

    function onCommentChange(
        project: Project,
        dataElement: DataElementInfo,
        comment: string
    ): void {
        if (merReport) onChange(merReport.setComment(project, dataElement, comment));
    }

    if (!merReport || !merReport.data.projectsData) return <LinearProgress />;

    return (
        <Paper>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell style={{ width: "15em" }}>{i18n.t("Project")}</TableCell>
                        <TableCell style={{ width: "35em" }}>{i18n.t("Indicators")}</TableCell>
                        <TableCell style={{ width: "3em" }}>{i18n.t("Target")}</TableCell>
                        <TableCell style={{ width: "3em" }}>{i18n.t("Actual")}</TableCell>
                        <TableCell style={{ width: "5em" }}>
                            {" "}
                            {i18n.t("Achieved to date (%)")}
                        </TableCell>
                        <TableCell style={{ width: "40em" }}>{i18n.t("Comment")}</TableCell>
                    </TableRow>
                </TableHead>

                <TableBody>
                    {merReport.data.projectsData.map(project => (
                        <React.Fragment key={project.id}>
                            <TableRow key={project.id}>
                                <TableCell rowSpan={project.dataElements.length}>
                                    {project.name}
                                    <br />
                                    <i>{project.dateInfo}</i>
                                </TableCell>
                                <DataElementCells
                                    project={project}
                                    dataElement={project.dataElements[0]}
                                    onChange={onCommentChange}
                                />
                            </TableRow>

                            {project.dataElements.slice(1).map(dataElement => (
                                <TableRow key={dataElement.id}>
                                    <DataElementCells
                                        project={project}
                                        dataElement={dataElement}
                                        onChange={onCommentChange}
                                    />
                                </TableRow>
                            ))}
                        </React.Fragment>
                    ))}
                </TableBody>
            </Table>
        </Paper>
    );
};

function formatNumber(n: number | undefined, suffix?: string): string {
    return n === undefined ? "-" : n.toFixed(2) + (suffix || "");
}

interface DataElementCellsProps {
    project: Project;
    dataElement: DataElementInfo;
    onChange(project: Project, dataElement: DataElementInfo, value: string): void;
}

const DataElementCells: React.FC<DataElementCellsProps> = ({ project, dataElement, onChange }) => (
    <React.Fragment>
        <TableCell>{dataElement.name}</TableCell>
        <TableCell>{formatNumber(dataElement.target)}</TableCell>
        <TableCell>{formatNumber(dataElement.actual)}</TableCell>
        <TableCell>{formatNumber(dataElement.achieved, "%")}</TableCell>
        <TableCell>
            <TextFieldOnBlur
                value={dataElement.comment}
                fullWidth={true}
                multiline={true}
                rows={getMultilineRows(dataElement.comment, 1, 4)}
                onBlurChange={value => onChange(project, dataElement, value)}
            />
        </TableCell>
    </React.Fragment>
);

function shouldKeepView(prevProps: ReportDataTableProps, nextProps: ReportDataTableProps): boolean {
    return prevProps.merReport.data.projectsData === nextProps.merReport.data.projectsData;
}

export default React.memo(ReportDataTable, shouldKeepView);

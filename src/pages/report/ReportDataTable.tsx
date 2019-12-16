import React, { useEffect } from "react";
import {
    Table,
    TableRow,
    TableHead,
    TableCell,
    TableBody,
    Paper,
    LinearProgress,
    TextField,
} from "@material-ui/core";

import MerReport, { DataElementInfo, Project } from "../../models/MerReport";
import i18n from "../../locales";

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
    console.log({ merReport });

    return (
        <Paper>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>{i18n.t("Project")}</TableCell>
                        <TableCell>{i18n.t("Indicators")}</TableCell>
                        <TableCell>{i18n.t("Target")}</TableCell>
                        <TableCell>{i18n.t("Actual")}</TableCell>
                        <TableCell>{i18n.t("Achieved to date (%)")}</TableCell>
                        <TableCell>{i18n.t("Comment")}</TableCell>
                    </TableRow>
                </TableHead>

                <TableBody>
                    {merReport.data.projectsData.map(project => (
                        <React.Fragment key={project.id}>
                            <TableRow key={project.id}>
                                <TableCell rowSpan={project.dataElements.length}>
                                    {project.name}
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

interface DataElementCellsProps {
    project: Project;
    dataElement: DataElementInfo;
    onChange(project: Project, dataElement: DataElementInfo, value: string): void;
}

// TODO: Use a Custom TextField using onBlur event to speed up UI
const DataElementCells: React.FC<DataElementCellsProps> = ({ project, dataElement, onChange }) => (
    <React.Fragment>
        <TableCell>{dataElement.name}</TableCell>
        <TableCell>{dataElement.target}</TableCell>
        <TableCell>{dataElement.actual}</TableCell>
        <TableCell>{dataElement.achieved}</TableCell>
        <TableCell style={{ width: "40em" }}>
            <TextField
                value={dataElement.comment}
                onChange={ev => onChange(project, dataElement, ev.target.value)}
            />
        </TableCell>
    </React.Fragment>
);

export default ReportDataTable;

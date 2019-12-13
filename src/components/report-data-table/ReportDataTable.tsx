import React, { useEffect } from "react";
import MerReport, { ProjectsData } from "../../models/MerReport";

interface ReportDataTableProps {
    merReport: MerReport;
}

const ReportDataTable: React.FC<ReportDataTableProps> = props => {
    const { merReport } = props;
    const { date, organisationUnit } = merReport.data;
    if (!date || !organisationUnit) return null;

    const [projectsData, projectsDataSet] = React.useState<ProjectsData | null>(null);
    useEffect(() => {
        merReport.getProjectsData().then(projectsDataSet);
    }, [merReport]);
    console.log(projectsData);

    return (
        <p>
            date={date.toString()}, ou={organisationUnit.toString()}
        </p>
    );
};

export default ReportDataTable;

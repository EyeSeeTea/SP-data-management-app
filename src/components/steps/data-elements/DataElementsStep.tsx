import React, { useState } from "react";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import DataElementsTable, { DataElementsTableProps } from "./DataElementsTable";
import Sidebar from "./Sidebar";

interface DataElementsStepProps extends StepProps {
    field: DataElementsTableProps["field"];
}

const DataElementsStep: React.FC<DataElementsStepProps> = ({ onChange, project, field }) => {
    const { dataElements } = project;
    const menuItems = React.useMemo(
        () => project.sectors.map(sector => ({ id: sector.id, text: sector.displayName })),
        [project]
    );
    const [sectorId, setSectorId] = useState<string | undefined>(
        menuItems.length > 0 ? menuItems[0].id : undefined
    );

    return (
        <Sidebar
            menuItems={menuItems}
            currentMenuItemId={sectorId}
            onMenuItemClick={item => setSectorId(item.id)}
            contents={
                <div style={{ width: "100%" }}>
                    <DataElementsTable
                        field={field}
                        dataElementsSet={dataElements}
                        sectorId={sectorId}
                        project={project}
                        onChange={onChange}
                    />
                </div>
            }
        />
    );
};

export default DataElementsStep;

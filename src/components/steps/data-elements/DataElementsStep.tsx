import React, { useState } from "react";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import DataElementsTable from "./DataElementsTable";
import Sidebar from "./Sidebar";

const DataElementsStep: React.FC<StepProps> = ({ onChange, project }) => {
    const { dataElements } = project;
    const menuItems = project.sectors.map(sector => ({
        id: sector.id,
        text: sector.displayName,
    }));
    const [sectorId, setSectorId] = useState<string | undefined>(
        menuItems.length > 0 ? menuItems[0].id : undefined
    );

    function onSelectionChange(dataElementIds: string[]) {
        const projectUpdated = project.updateDataElementSelection(dataElementIds);
        onChange(projectUpdated);
    }

    return (
        <Sidebar
            menuItems={menuItems}
            currentMenuItemId={sectorId}
            onMenuItemClick={item => setSectorId(item.id)}
            contents={
                <DataElementsTable
                    dataElements={dataElements}
                    sectorId={sectorId}
                    onSelectionChange={onSelectionChange}
                />
            }
        />
    );
};

export default DataElementsStep;

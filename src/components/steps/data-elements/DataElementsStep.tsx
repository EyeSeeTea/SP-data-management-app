import React, { useState } from "react";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import DataElementsTable from "./DataElementsTable";
import Sidebar from "./Sidebar";

interface DataElementsStepProps extends StepProps {
    type: "mainSelection" | "merSelection";
}

const DataElementsStep: React.FC<DataElementsStepProps> = props => {
    const { onChange, project, type } = props;
    const menuItems = React.useMemo(
        () => project.sectors.map(sector => ({ id: sector.id, text: sector.displayName })),
        [project]
    );
    const [sectorId, setSectorId] = useState<string>(menuItems.length > 0 ? menuItems[0].id : "");

    const onSelectionChange = React.useCallback(
        dataElementIds => {
            if (!sectorId) return {};
            const res =
                type === "mainSelection"
                    ? project.updateDataElementsSelection(sectorId, dataElementIds)
                    : project.updateDataElementsMERSelection(sectorId, dataElementIds);
            const { selectionInfo, project: projectUpdated } = res;
            onChange(projectUpdated);
            return selectionInfo;
        },
        [project, sectorId]
    );

    const dataElementsSet =
        type === "mainSelection" ? project.dataElementsSelection : project.dataElementsMER;

    if (!sectorId) return null;

    return (
        <Sidebar
            menuItems={menuItems}
            currentMenuItemId={sectorId}
            onMenuItemClick={item => setSectorId(item.id)}
            contents={
                <div style={{ width: "100%" }}>
                    <DataElementsTable
                        dataElementsSet={dataElementsSet}
                        sectorId={sectorId}
                        onSelectionChange={onSelectionChange}
                    />
                </div>
            }
        />
    );
};

export default React.memo(DataElementsStep);

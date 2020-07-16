import React, { useState } from "react";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import DataElementsTable, { FieldName } from "./DataElementsTable";
import Sidebar from "./Sidebar";
import { Id } from "../../../types/d2-api";
import DataElementsSet, { ProjectSelection } from "../../../models/dataElementsSet";

export interface DataElementsStepProps extends StepProps {
    onSelect(sectorId: Id, dataElementIds: Id[]): ProjectSelection;
    dataElementsSet: DataElementsSet;
}

const DataElementsStep: React.FC<DataElementsStepProps> = props => {
    const { onChange, project, dataElementsSet, onSelect } = props;
    const menuItems = React.useMemo(
        () => project.sectors.map(sector => ({ id: sector.id, text: sector.displayName })),
        [project]
    );
    const [sectorId, setSectorId] = useState<string>(menuItems.length > 0 ? menuItems[0].id : "");

    const onSelectionChange = React.useCallback(
        (dataElementIds: Id[]) => {
            if (!sectorId) return {};
            const { selectionInfo, project: projectUpdated } = onSelect(sectorId, dataElementIds);
            onChange(projectUpdated);
            return selectionInfo;
        },
        [project, sectorId]
    );

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
                        columns={initialColumns}
                    />
                </div>
            }
        />
    );
};

const initialColumns: FieldName[] = [
    "name",
    "code",
    "indicatorType",
    "peopleOrBenefit",
    "series",
    "countingMethod",
    "externals",
];

export default React.memo(DataElementsStep);

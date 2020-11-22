import React from "react";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import DataElementsTable, { FieldName } from "./DataElementsTable";
import { Id } from "../../../types/d2-api";
import DataElementsSet, { ProjectSelection } from "../../../models/dataElementsSet";
import SectionsSidebar from "../../sections-sidebar/SectionsSidebar";
import { useSectionsSidebar } from "../../sections-sidebar/sections-sidebar-hooks";

export interface DataElementsStepProps extends StepProps {
    onSelect(sectorId: Id, dataElementIds: Id[]): ProjectSelection;
    dataElementsSet: DataElementsSet;
}

const DataElementsStep: React.FC<DataElementsStepProps> = props => {
    const { onChange, project, dataElementsSet, onSelect } = props;
    const { items: sectorItems, sectorId, setSector } = useSectionsSidebar(project);

    const onSelectionChange = React.useCallback(
        (dataElementIds: Id[]) => {
            if (!sectorId) return {};
            const { selectionInfo, project: projectUpdated } = onSelect(sectorId, dataElementIds);
            onChange(projectUpdated);
            return selectionInfo;
        },
        [sectorId, onSelect, onChange]
    );

    if (!sectorId) return null;

    return (
        <SectionsSidebar items={sectorItems} sectorId={sectorId} setSector={setSector}>
            <DataElementsTable
                dataElementsSet={dataElementsSet}
                sectorId={sectorId}
                onSelectionChange={onSelectionChange}
                columns={initialColumns}
            />
        </SectionsSidebar>
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

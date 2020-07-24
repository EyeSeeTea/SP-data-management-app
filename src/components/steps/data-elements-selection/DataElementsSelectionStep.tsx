import React from "react";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import DataElementsStep, { DataElementsStepProps } from "../data-elements/DataElementsStep";

const DataElementsSelectionStep: React.FC<StepProps> = props => {
    const { project } = props;
    const getSelection: DataElementsStepProps["onSelect"] = React.useCallback(
        (sectorId, dataElementIds) => {
            return project.updateDataElementsSelection(sectorId, dataElementIds);
        },
        [project]
    );

    return (
        <DataElementsStep
            {...props}
            onSelect={getSelection}
            dataElementsSet={project.dataElementsSelection}
        />
    );
};

export default React.memo(DataElementsSelectionStep);

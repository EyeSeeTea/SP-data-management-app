import React from "react";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import DataElementsStep, { DataElementsStepProps } from "../data-elements/DataElementsStep";

const DataElementsMER: React.FC<StepProps> = props => {
    const { project } = props;
    const getSelection: DataElementsStepProps["onSelect"] = React.useCallback(
        (sectorId, dataElementIds) => {
            return project.updateDataElementsMERSelection(sectorId, dataElementIds);
        },
        [project]
    );

    return (
        <DataElementsStep
            {...props}
            onSelect={getSelection}
            dataElementsSet={project.dataElementsMER}
        />
    );
};

export default React.memo(DataElementsMER);

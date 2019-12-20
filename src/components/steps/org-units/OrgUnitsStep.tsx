import React from "react";

import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import UserOrgUnits from "../../org-units/UserOrgUnits";

interface OrganisationUnit {
    id: string;
    path: string;
    displayName: string;
}

const OrgUnitsStep: React.FC<StepProps> = ({ project, onChange }) => {
    const setOrgUnit = async (orgUnit: OrganisationUnit) => {
        const newProject = project.set("parentOrgUnit", orgUnit);
        onChange(newProject);
    };

    return (
        <UserOrgUnits
            onChange={setOrgUnit}
            selected={project.parentOrgUnit}
            selectableLevels={[2]}
            height={300}
        />
    );
};

export default OrgUnitsStep;

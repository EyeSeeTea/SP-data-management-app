import React from "react";
import _ from "lodash";

import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import UserOrgUnits from "../../org-units/UserOrgUnits";

const OrgUnitsStep: React.FC<StepProps> = ({ project, onChange }) => {
    const setOrgUnits = (orgUnitsPaths: string[]) => {
        const orgUnits = orgUnitsPaths.map(path => ({ path }));
        const newProject = project.set("parentOrgUnit", _.last(orgUnits));
        onChange(newProject);
    };

    const selectedPaths = project.parentOrgUnit ? [project.parentOrgUnit.path] : [];

    return (
        <UserOrgUnits
            onChange={setOrgUnits}
            selected={selectedPaths}
            selectableLevels={[2]}
            height={300}
        />
    );
};

export default OrgUnitsStep;

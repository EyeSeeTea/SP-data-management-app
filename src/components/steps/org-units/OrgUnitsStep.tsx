import React from "react";
import _ from "lodash";

import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import UserOrgUnits from "../../org-units/UserOrgUnits";

const OrgUnitsStep: React.FC<StepProps> = ({ project, onChange }) => {
    const setOrgUnits = (orgUnitsPaths: string[]) => {
        const orgUnits = orgUnitsPaths.map(path => ({ path }));
        const newProject = project.set("organisationUnit", _.last(orgUnits));
        onChange(newProject);
    };
    const selectedPaths = project.organisationUnit ? [project.organisationUnit.path] : [];

    return <UserOrgUnits onChange={setOrgUnits} selected={selectedPaths} selectableLevels={[2]} />;
};

export default OrgUnitsStep;

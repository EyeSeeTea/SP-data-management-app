import React from "react";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import UserOrgUnits from "../../org-units/UserOrgUnits";
import { Title, getValuesFromSelection } from "../utils/common";
import { MultiSelector } from "d2-ui-components";
import { getProjectFieldName } from "../../../utils/form";
import { useAppContext } from "../../../contexts/api-context";

interface OrganisationUnit {
    id: string;
    path: string;
    displayName: string;
}

const OrgUnitsStep: React.FC<StepProps> = ({ project, onChange }) => {
    const { d2, config } = useAppContext();

    const setOrgUnit = async (orgUnit: OrganisationUnit) => {
        const newProject = project.setCountry(orgUnit);
        onChange(newProject);
    };

    function setLocations(selected: string[]) {
        const newValue = getValuesFromSelection(config.locations, selected);
        const newProject = project.set("locations", newValue);
        onChange(newProject);
    }

    const locationOptions = React.useMemo(() => {
        return project
            .getSelectableLocations(project.parentOrgUnit)
            .map(location => ({ value: location.id, text: location.displayName }));
    }, [project]);

    return (
        <React.Fragment>
            <Title style={{ marginTop: 35, marginBottom: 10 }}>
                {getProjectFieldName("parentOrgUnit")}
            </Title>
            <UserOrgUnits
                onChange={setOrgUnit}
                selected={project.parentOrgUnit}
                selectableLevels={[2]}
                height={300}
            />

            <Title style={{ marginTop: 35 }}>{getProjectFieldName("locations")}</Title>
            <div data-test-selector="locations" style={{ paddingBottom: 10 }}>
                <MultiSelector
                    searchFilterLabel={true}
                    d2={d2}
                    ordered={true}
                    height={300}
                    onChange={setLocations}
                    options={locationOptions}
                    selected={project.locations.map(location => location.id)}
                />
            </div>
        </React.Fragment>
    );
};

export default React.memo(OrgUnitsStep);

import React from "react";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import UserOrgUnits from "../../org-units/UserOrgUnits";
import { Title, getValuesFromSelection } from "../utils/common";
import { MultiSelector } from "@eyeseetea/d2-ui-components";
import { getProjectFieldName } from "../../../utils/form";
import { useAppContext } from "../../../contexts/api-context";

interface OrganisationUnit {
    id: string;
    path: string;
    displayName: string;
}

const OrgUnitsStep: React.FC<StepProps> = ({ project, onChange }) => {
    const { d2, config } = useAppContext();

    const setOrgUnit = React.useCallback(
        (orgUnit: OrganisationUnit) => {
            const newProject = project.setCountry(orgUnit);
            onChange(newProject);
        },
        [onChange, project]
    );

    const setLocations = React.useCallback(
        (selected: string[]) => {
            const newValue = getValuesFromSelection(config.locations, selected);
            const newProject = project.set("locations", newValue);
            onChange(newProject);
        },
        [onChange, project, config.locations]
    );

    const locationOptions = React.useMemo(() => {
        return project
            .getSelectableLocations(project.parentOrgUnit)
            .map(location => ({ value: location.id, text: location.displayName }));
    }, [project]);

    const selectedLocations = React.useMemo(() => project.locations.map(location => location.id), [
        project,
    ]);

    return (
        <React.Fragment>
            <Title style={styles.title1}>{getProjectFieldName("parentOrgUnit")}</Title>
            <UserOrgUnits
                onChange={setOrgUnit}
                selected={project.parentOrgUnit}
                selectableLevels={selectableLevels}
                height={300}
            />

            <Title style={styles.title2}>{getProjectFieldName("locations")}</Title>
            <div data-test-selector="locations" style={styles.locations}>
                <MultiSelector
                    searchFilterLabel={true}
                    d2={d2}
                    ordered={true}
                    height={300}
                    onChange={setLocations}
                    options={locationOptions}
                    selected={selectedLocations}
                />
            </div>
        </React.Fragment>
    );
};

const styles = {
    title1: { marginTop: 35, marginBottom: 10 },
    title2: { marginTop: 35 },
    locations: { paddingBottom: 10 },
};

const selectableLevels = [2];

export default React.memo(OrgUnitsStep);

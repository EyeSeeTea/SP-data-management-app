import React, { useMemo } from "react";
import { Card, CardContent } from "@material-ui/core";
import { MultiSelector } from "d2-ui-components";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import { useAppContext } from "../../../contexts/api-context";
import { getProjectFieldName } from "../../../utils/form";
import { Title, getValuesFromSelection } from "../utils/common";

const SectorsStep: React.FC<StepProps> = ({ project, onChange }) => {
    const { d2, config } = useAppContext();

    function setSectors(selected: string[]) {
        const newValue = getValuesFromSelection(config.sectors, selected);
        const newProject = project.set("sectors", newValue);
        onChange(newProject);
    }

    const [sectorOptions] = useMemo(() => {
        return [config.sectors.map(sector => ({ value: sector.id, text: sector.displayName }))];
    }, [config]);

    return (
        <Card>
            <CardContent>
                <Title>{getProjectFieldName("sectors")}</Title>
                <div data-test-selector="sectors">
                    <MultiSelector
                        d2={d2}
                        ordered={true}
                        height={300}
                        onChange={setSectors}
                        options={sectorOptions}
                        selected={project.sectors.map(sector => sector.id)}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default React.memo(SectorsStep);

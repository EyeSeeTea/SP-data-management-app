import React, { useMemo } from "react";
import _ from "lodash";
import { Card, CardContent } from "@material-ui/core";
import { MultiSelector } from "d2-ui-components";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import { useAppContext } from "../../../contexts/api-context";
import { CSSProperties } from "@material-ui/core/styles/withStyles";
import { getProjectFieldName } from "../../../utils/form";
import { Sector, Location } from "../../../models/Config";

type Option = { value: string; text: string };
type ModelCollectionField = "sectors" | "locations";

const defaultTitleStyle = { fontSize: "1.1em", color: "grey" };

const Title: React.FC<{ style?: CSSProperties }> = ({ style, children }) => {
    const finalStyle = style ? { ...defaultTitleStyle, ...style } : defaultTitleStyle;
    return <div style={finalStyle}>{children}</div>;
};

const SectorsStep: React.FC<StepProps> = ({ project, onChange }) => {
    const { d2, config } = useAppContext();

    const onUpdateField = (fieldName: ModelCollectionField, selected: string[]) => {
        const newValue = _(config[fieldName])
            .keyBy((obj: Sector | Location) => obj.id)
            .at(selected)
            .compact()
            .value() as Sector[] | Location[];
        const newProject = project.set(fieldName, newValue);
        onChange(newProject);
    };

    const [sectorOptions] = useMemo(() => {
        return [config.sectors.map(sector => ({ value: sector.id, text: sector.displayName }))];
    }, [config]);

    const locationOptions = useMemo(() => {
        return project
            .getSelectableLocations(project.parentOrgUnit)
            .map(location => ({ value: location.id, text: location.displayName }));
    }, [project.parentOrgUnit]);

    return (
        <Card>
            <CardContent style={{ padding: "5px 0 0 0" }}>
                <Title>{getProjectFieldName("sectors")}</Title>
                <div data-test-selector="sectors">
                    <MultiSelector
                        d2={d2}
                        ordered={true}
                        height={300}
                        onChange={(selected: string[]) => onUpdateField("sectors", selected)}
                        options={sectorOptions}
                        selected={project.sectors.map(sector => sector.id)}
                    />
                </div>

                <Title style={{ marginTop: 35 }}>{getProjectFieldName("locations")}</Title>
                <div data-test-selector="locations" style={{ paddingBottom: 10 }}>
                    <MultiSelector
                        d2={d2}
                        ordered={true}
                        height={300}
                        onChange={(selected: string[]) => onUpdateField("locations", selected)}
                        options={locationOptions}
                        selected={project.locations.map(location => location.id)}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default SectorsStep;

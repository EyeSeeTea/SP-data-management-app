import React, { useMemo } from "react";
import _ from "lodash";
import { Card, CardContent } from "@material-ui/core";
import { MultiSelector } from "d2-ui-components";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import { useAppContext } from "../../../contexts/api-context";
import { CSSProperties } from "@material-ui/core/styles/withStyles";
import { getProjectFieldName } from "../../../utils/form";

type Option = { value: string; text: string };
type ModelCollectionField = "sectors" | "locations";

const defaultTitleStyle = { fontSize: "1.1em", color: "grey" };

const Title: React.FC<{ style?: CSSProperties }> = ({ style, children }) => {
    const finalStyle = style ? { ...defaultTitleStyle, ...style } : defaultTitleStyle;
    return <div style={finalStyle}>{children}</div>;
};

const SectorsStep: React.FC<StepProps> = ({ project, onChange }) => {
    const { d2, config } = useAppContext();

    const onUpdateField = <K extends ModelCollectionField>(
        fieldName: K,
        options: Option[],
        selected: string[]
    ) => {
        const newValue = _(options)
            .keyBy(option => option.value)
            .at(selected)
            .compact()
            .map(({ value, text }) => ({ id: value, displayName: text }))
            .value();
        const newProject = project.set(fieldName, newValue);
        onChange(newProject);
    };

    const [sectorOptions] = useMemo(() => {
        return [config.sectors.map(sector => ({ value: sector.id, text: sector.displayName }))];
    }, [config]);

    // an example, to change when locations it's set up
    const locations = [
        { id: "BS", displayName: "Bahamas" },
        { id: "BO", displayName: "Bolivia" },
        { id: "KH", displayName: "Cambodia" },
    ];
    const locationOptions = locations.map(location => ({
        value: location.id,
        text: location.displayName,
    }));

    return (
        <Card>
            <CardContent style={{ padding: "5px 0 0 0" }}>
                <Title>{getProjectFieldName("sectors")}</Title>
                <div data-test-selector="sectors">
                    <MultiSelector
                        d2={d2}
                        ordered={true}
                        height={300}
                        onChange={(selected: string[]) =>
                            onUpdateField("sectors", sectorOptions, selected)
                        }
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
                        onChange={
                            (selected: string[]) =>
                                onUpdateField("locations", locationOptions, selected) //to change "sectors" to "locations" when config is ready
                        }
                        options={locationOptions}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default SectorsStep;

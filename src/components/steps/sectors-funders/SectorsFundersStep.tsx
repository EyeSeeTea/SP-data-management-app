import React from "react";
import _ from "lodash";
import { Card, CardContent } from "@material-ui/core";

import { MultiSelector } from "d2-ui-components";
import i18n from "../../../locales";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import { useD2 } from "../../../contexts/api-context";
import { CSSProperties } from "@material-ui/core/styles/withStyles";

type Option = { value: string; text: string };

const sectorOptions = [
    { value: "1", text: "Sector1" },
    { value: "2", text: "Sector2" },
    { value: "3", text: "Sector3" },
    { value: "4", text: "Sector4" },
];

const fundersOptions = [
    { value: "1", text: "Atlas Copco" },
    { value: "2", text: "ACWME" },
    { value: "3", text: "Adventist Development Relief Agency" },
    { value: "4", text: "AECOM International Sudan" },
    { value: "5", text: "Academy for Educational Development" },
    { value: "6", text: "Agridius Foundation" },
];

type ModelCollectionField = "sectors" | "funders";

const defaultTitleStyle = { fontSize: "1.3em", color: "grey" };

const Title: React.FC<{ style?: CSSProperties }> = ({ style, children }) => {
    const finalStyle = style ? { ...defaultTitleStyle, ...style } : defaultTitleStyle;
    return <div style={finalStyle}>{children}</div>;
};

const SectorsFundersStep: React.FC<StepProps> = ({ project, onChange }) => {
    const d2 = useD2();

    const onUpdateField = <K extends ModelCollectionField>(
        fieldName: K,
        options: Option[],
        selected: string[]
    ) => {
        const newValue = _(options)
            .keyBy("value")
            .at(selected)
            .map(({ value, text }) => ({ id: value, displayName: text }))
            .value();
        const newProject = project.set(fieldName, newValue);
        onChange(newProject);
    };

    return (
        <Card>
            <CardContent>
                <Title>{i18n.t("Sectors")}</Title>
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

                <Title style={{ marginTop: 35 }}>{i18n.t("Project funders")}</Title>
                <div style={{ paddingRight: 40 }}>
                    <MultiSelector
                        d2={d2}
                        ordered={false}
                        height={300}
                        onChange={(selected: string[]) =>
                            onUpdateField("funders", fundersOptions, selected)
                        }
                        options={fundersOptions}
                        selected={project.funders.map(funders => funders.id)}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default SectorsFundersStep;

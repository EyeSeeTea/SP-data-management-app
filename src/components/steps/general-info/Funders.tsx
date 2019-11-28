import React, { useMemo } from "react";
import _ from "lodash";

import { CSSProperties } from "@material-ui/core/styles/withStyles";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import i18n from "../../../locales";

import { CardContent } from "@material-ui/core";
import { useAppContext } from "../../../contexts/api-context";

import { MultiSelector } from "d2-ui-components";

const defaultTitleStyle = { fontSize: "1.3em", color: "grey" };

const Title: React.FC<{ style?: CSSProperties }> = ({ style, children }) => {
    const finalStyle = style ? { ...defaultTitleStyle, ...style } : defaultTitleStyle;
    return <div style={finalStyle}>{children}</div>;
};
type ModelCollectionField = "funders";
type Option = { value: string; text: string };

const FundersStep: React.FC<StepProps> = ({ project, onChange }) => {
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
    const [funderOptions] = useMemo(() => {
        return [config.funders.map(funder => ({ value: funder.id, text: funder.displayName }))];
    }, [config]);

    return (
        <CardContent>
            <Title style={{ marginTop: 35 }}>{i18n.t("Project funders")}</Title>
            <div data-test-selector="funders" style={{ paddingRight: 40 }}>
                <MultiSelector
                    d2={d2}
                    searchFilterLabel={true}
                    ordered={false}
                    height={300}
                    onChange={(selected: string[]) =>
                        onUpdateField("funders", funderOptions, selected)
                    }
                    options={funderOptions}
                />
            </div>
        </CardContent>
    );
};

export default FundersStep;

import React, { useMemo } from "react";
import _ from "lodash";
import i18n from "../../../locales";

import { useAppContext } from "../../../contexts/api-context";
import { CardContent } from "@material-ui/core";
import { MultiSelector } from "d2-ui-components";
import { CSSProperties } from "@material-ui/core/styles/withStyles";
import Project from "../../../models/Project";

const defaultTitleStyle = { fontSize: "1.1em", color: "grey" };

const Title: React.FC<{ style?: CSSProperties }> = ({ style, children }) => {
    const finalStyle = style ? { ...defaultTitleStyle, ...style } : defaultTitleStyle;
    return <div style={finalStyle}>{children}</div>;
};

interface FundersProps {
    project: Project;
    onChange: (project: Project) => void;
}
type ModelCollectionField = "funders";
type Option = { value: string; text: string };

const Funders: React.FC<FundersProps> = ({ project, onChange }) => {
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
        <CardContent style={{ padding: "5px 0 0 0" }}>
            <Title style={{ marginTop: 35 }}>{i18n.t("Project funders (*)")}</Title>
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
                    selected={project.funders.map(funder => funder.id)}
                />
            </div>
        </CardContent>
    );
};

export default Funders;

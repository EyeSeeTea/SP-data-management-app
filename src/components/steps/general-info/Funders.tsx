import React, { useMemo } from "react";
import i18n from "../../../locales";
import _ from "lodash";

import { ConfirmationDialog } from "@eyeseetea/d2-ui-components";
import { useAppContext } from "../../../contexts/api-context";
import { CardContent } from "@material-ui/core";
import { MultiSelector } from "@eyeseetea/d2-ui-components";
import { CSSProperties } from "@material-ui/core/styles/withStyles";
import Project from "../../../models/Project";
import { getProjectFieldName } from "../../../utils/form";

interface FundersProps {
    project: Project;
    onChange: (project: Project) => void;
}

interface Funder {
    id: string;
    displayName: string;
    shortName: string;
}

type ModelCollectionField = "funders";
type AdditionalDesignationField = "additional";
type Option = { value: string; text: string; code: string };

const Funders: React.FC<FundersProps> = ({ project, onChange }) => {
    const [isDialogOpen, setDialogOpen] = React.useState(false);
    const [fundersAdded, setFundersAdded] = React.useState<Funder[]>([]);
    const [code, setCode] = React.useState<string[]>([]);

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
            .map(({ value, text, code }) => ({ id: value, displayName: text, shortName: code }))
            .value();
        const newProject = project.set(fieldName, newValue);
        onChange(newProject);
        setFundersAdded(newValue);
    };
    const [funderOptions] = useMemo(() => {
        return [
            config.funders.map(funder => ({
                value: funder.id,
                text: funder.displayName,
                code: funder.shortName,
            })),
        ];
    }, [config]);

    const updateAdditionalDesignationField = <K extends AdditionalDesignationField>(
        fieldName: K,
        selected: string
    ) => {
        const newProject = project.set(fieldName, selected);
        onChange(newProject);
    };

    return (
        <>
            <CardContent style={{ padding: "5px 0 0 0" }}>
                <Title style={{ marginTop: 35 }}>{getProjectFieldName("funders")}</Title>
                <div data-test-selector="funders" style={{ paddingRight: 40 }}>
                    <MultiSelector
                        d2={d2}
                        searchFilterLabel={true}
                        ordered={false}
                        height={300}
                        onChange={(selected: string[]) => {
                            onUpdateField("funders", funderOptions, selected);
                            setDialogOpen(true);
                        }}
                        options={funderOptions}
                        selected={project.funders.map(funder => funder.id)}
                    />
                </div>
            </CardContent>
            {isDialogOpen && (
                <ConfirmationDialog
                    isOpen={isDialogOpen}
                    title={i18n.t(
                        "Would you like to use the funder code in the additional designation field?"
                    )}
                    cancelText={i18n.t("No")}
                    saveText={i18n.t("Yes")}
                    onCancel={() => {
                        setDialogOpen(false);
                    }}
                    onSave={() => {
                        if (fundersAdded) {
                            code.push(fundersAdded[fundersAdded.length - 1].shortName);
                            setCode(code);
                            updateAdditionalDesignationField("additional", code.join("-"));
                        }
                        setDialogOpen(false);
                    }}
                    maxWidth="sm"
                    fullWidth={true}
                />
            )}
        </>
    );
};

const defaultTitleStyle = { fontSize: "1.1em", color: "grey" };

const Title: React.FC<{ style?: CSSProperties }> = ({ style, children }) => {
    const finalStyle = style ? { ...defaultTitleStyle, ...style } : defaultTitleStyle;
    return <div style={finalStyle}>{children}</div>;
};

export default React.memo(Funders);

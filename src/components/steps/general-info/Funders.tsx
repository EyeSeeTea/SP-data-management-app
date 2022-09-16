import React, { useMemo } from "react";
import i18n from "../../../locales";
import _ from "lodash";

import { ConfirmationDialog, useSnackbar } from "@eyeseetea/d2-ui-components";
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

type ModelCollectionField = "funders";
type Option = { value: string; text: string; shortName: string; code: string };

const Funders: React.FC<FundersProps> = ({ project, onChange }) => {
    const [isDialogOpen, setDialogOpen] = React.useState(false);
    const [selectedFunders, setSelectedFunders] = React.useState<string[]>(() =>
        project.funders.map(funder => funder.id)
    );

    const { d2, config } = useAppContext();
    const snackbar = useSnackbar();

    const updateProject = <K extends ModelCollectionField>(
        fieldName: K,
        options: Option[],
        selected: string[]
    ) => {
        const newValue = _(options)
            .keyBy(option => option.value)
            .at(selected)
            .compact()
            .map(({ value, text, shortName, code }) => ({
                id: value,
                displayName: text,
                shortName: shortName,
                code: code,
            }))
            .value();
        return project.set(fieldName, newValue);
    };

    const [funderOptions] = useMemo(() => {
        return [
            config.funders.map(funder => ({
                value: funder.id,
                text: funder.displayName,
                shortName: funder.shortName,
                code: funder.code,
            })),
        ];
    }, [config]);

    const updateAdditionalDesignation = React.useCallback(
        (project: Project) => {
            const newProject = project.set("additional", project.getAdditionalFromFunders());
            onChange(newProject);
        },
        [onChange]
    );

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
                            setSelectedFunders(selected);
                            const prevSelected = selectedFunders;
                            const newProject = updateProject("funders", funderOptions, selected);

                            if (prevSelected.length < selected.length) {
                                onChange(newProject);
                                setDialogOpen(true);
                            } else if (prevSelected.length > selected.length) {
                                updateAdditionalDesignation(newProject);
                                snackbar.success(
                                    i18n.t(
                                        "The additional designation field has been updated due to funder change"
                                    )
                                );
                            }
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
                        updateAdditionalDesignation(project);
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

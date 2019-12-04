import React, { useState, useEffect, ReactNode } from "react";
import { Button, LinearProgress } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import ExitWizardButton from "../../wizard/ExitWizardButton";
import i18n from "../../../locales";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import Project from "../../../models/Project";
import { useSnackbar } from "d2-ui-components";
import { useHistory } from "react-router";
import { generateUrl } from "../../../router";

const useStyles = makeStyles({
    wrapper: {
        padding: 5,
    },
    saveButton: {
        margin: 10,
        backgroundColor: "#2b98f0",
        color: "white",
    },
});

const SaveStep: React.FC<StepProps> = ({ project, onCancel }) => {
    const [isSaving] = useState(false);
    const [orgUnit, setOrgUnitName] = useState("...");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const snackbar = useSnackbar();
    const history = useHistory();

    useEffect(() => {
        project.getOrganisationUnitName().then(name => setOrgUnitName(name || "unknown"));
    }, [project]);

    const classes = useStyles();

    async function save() {
        const { payload, response, project: projectSaved } = await project.save();
        if (response.status === "OK") {
            history.push(generateUrl("projects"));
            snackbar.success(i18n.t(`Project created: ${projectSaved.name}`));
        } else {
            setErrorMessage(JSON.stringify({ response, payload }, null, 2));
        }
    }

    return (
        <React.Fragment>
            <ExitWizardButton
                isOpen={dialogOpen}
                onConfirm={onCancel}
                onCancel={() => setDialogOpen(false)}
            />

            <div className={classes.wrapper}>
                <ul>
                    <LiEntry label={i18n.t("Name")} value={project.name} />
                    <LiEntry label={i18n.t("Description")} value={project.description} />
                    <LiEntry label={i18n.t("Award Number")} value={project.awardNumber} />
                    <LiEntry
                        label={i18n.t("Subsequent Lettering")}
                        value={project.subsequentLettering}
                    />
                    <LiEntry label={i18n.t("Speed Key")} value={project.speedKey} />

                    <LiEntry
                        label={i18n.t("Period dates")}
                        value={getProjectPeriodDateString(project)}
                    />

                    <LiEntry label={i18n.t("Funders")} value={getNames(project.funders)} />

                    <LiEntry label={i18n.t("Selected country")} value={orgUnit} />

                    <LiEntry label={i18n.t("Sectors")} value={getSectorsInfo(project)} />
                </ul>

                <Button onClick={() => setDialogOpen(true)} variant="contained">
                    {i18n.t("Cancel")}
                </Button>

                <Button className={classes.saveButton} onClick={() => save()} variant="contained">
                    {i18n.t("Save")}
                </Button>

                {isSaving && <LinearProgress />}

                <pre>{errorMessage}</pre>
            </div>
        </React.Fragment>
    );
};

const LiEntry = ({ label, value }: { label: string; value?: React.ReactNode }) => {
    return (
        <li key={label}>
            {label}:&nbsp;{value || "-"}
        </li>
    );
};

function getSectorsInfo(project: Project): ReactNode {
    return (
        <ul>
            {project.sectors.map(sector => {
                const dataElements = project.dataElements.get({
                    onlySelected: true,
                    sectorId: sector.id,
                    includePaired: true,
                });
                const value = (
                    <ul>
                        {dataElements.map(de => (
                            <li key={de.id}>{de.name}</li>
                        ))}
                    </ul>
                );
                return <LiEntry key={sector.id} label={sector.displayName} value={value} />;
            })}
        </ul>
    );
}

function getNames(objects: { displayName: string }[]) {
    return objects.map(obj => obj.displayName).join(", ");
}

function getProjectPeriodDateString(project: Project): string {
    const { startDate, endDate } = project;

    if (startDate && endDate) {
        return [startDate.format("LL"), "->", endDate.format("LL")].join(" ");
    } else {
        return "-";
    }
}

export default SaveStep;

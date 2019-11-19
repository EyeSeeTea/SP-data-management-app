import React, { useState, useEffect, ReactNode } from "react";
import _ from "lodash";
import { Button, LinearProgress } from "@material-ui/core";
import { PaginatedObjects } from "d2-api";
import { makeStyles } from "@material-ui/core/styles";

import ExitWizardButton from "../../wizard/ExitWizardButton";
import i18n from "../../../locales";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import Project from "../../../models/Project";
import { useSnackbar } from "d2-ui-components";

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

type OrganisationUnit = { id: string; displayName: string };

const SaveStep: React.FC<StepProps> = ({ project, onCancel }) => {
    const [isSaving] = useState(false);
    const [orgUnits, setOrgUnits] = useState<undefined | PaginatedObjects<OrganisationUnit>>(
        undefined
    );
    const [dialogOpen, setDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const snackbar = useSnackbar();

    useEffect(() => {
        project.getOrganisationUnitsWithName().then(paginatedOus => setOrgUnits(paginatedOus));
    }, [project]);

    const classes = useStyles();

    async function save() {
        const { response, project: projectSaved } = await project.save();
        if (response.status === "OK") {
            snackbar.success(i18n.t(`Project created: ${projectSaved.name}`));
        } else {
            setErrorMessage(JSON.stringify(response, null, 2));
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

                    <LiEntry
                        label={i18n.t("Organisation Units")}
                        value={getNamesFromPaginated(orgUnits)}
                    />

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
            {project.sectors.map(sector => (
                <LiEntry
                    key={sector.id}
                    label={sector.displayName}
                    value={
                        project.dataElements.getSelected({ sectorId: sector.id }).length +
                        " " +
                        i18n.t("data elements")
                    }
                />
            ))}
        </ul>
    );
}

function getNames(objects: { displayName: string }[]) {
    return objects.map(obj => obj.displayName).join(", ");
}

function getNamesFromPaginated(
    paginatedObjects: PaginatedObjects<{ displayName: string }> | undefined
) {
    if (!paginatedObjects) {
        return i18n.t("Loading...");
    } else {
        const { pager, objects } = paginatedObjects;
        const othersCount = pager.total - objects.length;
        const names =
            _(objects)
                .map(obj => obj.displayName)
                .sortBy()
                .join(", ") || i18n.t("[None]");
        if (othersCount > 0) {
            return i18n.t("[{{total}}] {{names}} and {{othersCount}} other(s)", {
                total: pager.total,
                names,
                othersCount,
            });
        } else {
            return `[${pager.total}] ${names}`;
        }
    }
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

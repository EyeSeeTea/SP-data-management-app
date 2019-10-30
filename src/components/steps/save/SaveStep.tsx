import React, { useState, useEffect } from "react";
import _ from "lodash";
import { Button, LinearProgress } from "@material-ui/core";
import { PaginatedObjects } from "d2-api";
import { makeStyles } from "@material-ui/core/styles";

import ExitWizardButton from "../../wizard/ExitWizardButton";
import i18n from "../../../locales";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import Project from "../../../models/Project";

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
    const [errorMessages] = useState<string[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);

    useEffect(() => {
        project.getOrganisationUnitsWithName().then(paginatedOus => setOrgUnits(paginatedOus));
    }, [project]);

    const classes = useStyles();

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
                    <LiEntry label={i18n.t("Code")} value={project.code} />
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

                    <LiEntry label={i18n.t("Sectors")} value={getNames(project.sectors)} />
                    <LiEntry label={i18n.t("Funders")} value={getNames(project.funders)} />

                    <LiEntry
                        label={i18n.t("Organisation Units")}
                        value={getNamesFromPaginated(orgUnits)}
                    />
                </ul>

                <Button onClick={() => setDialogOpen(true)} variant="contained">
                    {i18n.t("Cancel")}
                </Button>

                <Button
                    className={classes.saveButton}
                    onClick={() => console.log("TODO")}
                    variant="contained"
                >
                    {i18n.t("Save")}
                </Button>

                {isSaving && <LinearProgress />}

                <pre>{errorMessages.join("\n")}</pre>
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

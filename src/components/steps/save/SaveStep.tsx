import React, { useState, ReactNode, ReactElement } from "react";
import { Button, LinearProgress } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import ExitWizardButton from "../../wizard/ExitWizardButton";
import i18n from "../../../locales";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import Project from "../../../models/Project";
import { useSnackbar } from "d2-ui-components";
import { useHistory } from "react-router";
import { generateUrl } from "../../../router";
import { useAppContext } from "../../../contexts/api-context";
import { saveDataValues } from "../../../models/dev-project";
import { ProjectNotification } from "../../../models/ProjectNotification";

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

const SaveStep: React.FC<StepProps> = ({ project, onCancel, action }) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const classes = useStyles();
    const projectInfo = React.useMemo(() => <ProjectInfo project={project} />, [project]);
    const { isSaving, errorMessage, save } = useSave(project, action, projectInfo);

    return (
        <React.Fragment>
            <ExitWizardButton
                isOpen={dialogOpen}
                onConfirm={onCancel}
                onCancel={() => setDialogOpen(false)}
            />

            <div className={classes.wrapper}>
                {projectInfo}

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

interface LiEntryProps {
    label: string;
    value?: React.ReactNode;
}

const LiEntry: React.FC<LiEntryProps> = props => {
    const { label, value, children } = props;
    return (
        <li key={label}>
            {label}:&nbsp;{value || children || "-"}
        </li>
    );
};

const ProjectInfo: React.FC<{ project: Project }> = ({ project }) => (
    <ul>
        <LiEntry label={i18n.t("Name")} value={project.name} />
        <LiEntry label={i18n.t("Description")} value={project.description} />
        <LiEntry label={i18n.t("Award Number")} value={project.awardNumber} />
        <LiEntry label={i18n.t("Subsequent Lettering")} value={project.subsequentLettering} />
        <LiEntry label={i18n.t("Speed Key")} value={project.speedKey} />

        <LiEntry label={i18n.t("Period dates")} value={getProjectPeriodDateString(project)} />

        <LiEntry label={i18n.t("Funders")} value={getNames(project.funders)} />

        <LiEntry
            label={i18n.t("Selected country")}
            value={project.parentOrgUnit ? project.parentOrgUnit.displayName : "-"}
        />

        <LiEntry
            label={i18n.t("Locations")}
            value={project.locations.map(location => location.displayName).join(", ")}
        />

        <LiEntry label={i18n.t("Sharing")}>
            <ul>
                <li>
                    {i18n.t("Users") + ": "}
                    {project.sharing.userAccesses.map(ua => ua.name).join(", ") || " - "}
                </li>
                <li>
                    {i18n.t("User groups") + ": "}
                    {project.sharing.userGroupAccesses.map(uga => uga.name).join(", ") || " -"}
                </li>
            </ul>
        </LiEntry>

        <LiEntry label={i18n.t("Sectors")} value={getSectorsInfo(project)} />
    </ul>
);

function getSectorsInfo(project: Project): ReactNode {
    const sectorsInfo = project.getSectorsInfo();
    const hiddenMsg = i18n.t("Hidden in data entry as it is selected in multiple sectors!");

    return (
        <ul>
            {sectorsInfo.map(({ sector, dataElementsInfo }) => {
                const value = (
                    <ul>
                        {dataElementsInfo.map(({ dataElement, isMER, usedInDataSetSection }) => (
                            <li key={dataElement.id}>
                                {dataElement.name} - {dataElement.code}
                                {isMER ? ` [${i18n.t("MER")}]` : ""}
                                {usedInDataSetSection ? "" : <i> - {hiddenMsg}</i>}
                            </li>
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
    const dateFormat = "MMMM YYYY";

    if (startDate && endDate) {
        return [startDate.format(dateFormat), "->", endDate.format(dateFormat)].join(" ");
    } else {
        return "-";
    }
}

function useSave(project: Project, action: StepProps["action"], projectInfo: ReactElement) {
    const { api, isDev, isTest, appConfig, currentUser } = useAppContext();
    const [isSaving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const snackbar = useSnackbar();
    const history = useHistory();

    const save = React.useCallback(async () => {
        try {
            setSaving(true);
            const { payload, response, project: projectSaved } = await project.save();
            const recipients = appConfig.app.notifyEmailOnProjectSave;
            setSaving(false);

            if (response && response.status === "OK") {
                if (!isTest) {
                    const notificator = new ProjectNotification(api, projectSaved, currentUser);
                    notificator.notifyOnProjectSave(projectInfo, recipients, action);
                }
                const baseMsg =
                    action === "create" ? i18n.t("Project created") : i18n.t("Project updated");
                const msg = `${baseMsg}: ${projectSaved.name}`;
                history.push(generateUrl("projects"));
                if (isDev) saveDataValues(api, projectSaved);
                snackbar.success(msg);
            } else {
                setErrorMessage(JSON.stringify({ response, payload }, null, 2));
            }
        } catch (err) {
            setSaving(false);
            snackbar.error(err.message || err.toString());
        }
    }, [project, setSaving, history, snackbar, action, api, appConfig, isDev, projectInfo]);

    return { isSaving, errorMessage, save };
}

export default React.memo(SaveStep);

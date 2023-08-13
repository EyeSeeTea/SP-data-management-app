import React, { useState } from "react";
import { Button } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import ExitWizardButton from "../../wizard/ExitWizardButton";
import i18n from "../../../locales";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import Project from "../../../models/Project";
import { useLoading, useSnackbar } from "@eyeseetea/d2-ui-components";
import { useHistory } from "react-router";
import { generateUrl } from "../../../router";
import { useAppContext } from "../../../contexts/api-context";
import { saveDataValues } from "../../../models/dev-project";
import { ProjectNotification } from "../../../models/ProjectNotification";
import ExistingDataValuesDialog from "./ExistingDataValuesDialog";
import { ExistingData } from "../../../models/ProjectDb";
import _ from "lodash";
import { Action, ProjectInfo, ProjectInfoNode } from "../../../models/ProjectInfo";
import { Maybe } from "../../../types/utils";

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
    const { appConfig, api, currentUser, isTest } = useAppContext();
    const snackbar = useSnackbar();
    const classes = useStyles();
    const loading = useLoading();
    const projectInfo2 = React.useMemo(() => project.info.getNodes(), [project]);

    const [dialogOpen, setDialogOpen] = useState(false);
    const { isSaving, errorMessage, save } = useSave(project, action);

    const [existingData, setExistingData] = React.useState<ExistingData>();
    const closeExistingDataDialog = React.useCallback(() => setExistingData(undefined), []);

    const saveAndSendExistingDataMessage = React.useCallback(
        async (message: string) => {
            closeExistingDataDialog();
            await save();
            if (!existingData) return;

            const notificator = new ProjectNotification(
                api,
                appConfig,
                project,
                currentUser,
                isTest
            );
            await notificator.sendMessageForIndicatorsRemoval({
                message,
                currentUser,
                existingData,
            });
        },
        [appConfig, api, currentUser, closeExistingDataDialog, existingData, isTest, project, save]
    );

    const checkExistingDataAndSave = React.useCallback(async () => {
        loading.show(true, i18n.t("Validating Project"));
        const validation = await project.validate();
        const error = _(validation).values().flatten().join("\n");
        if (error) {
            loading.hide();
            snackbar.error(error);
            return;
        }

        loading.updateMessage(i18n.t("Checking Existing Data"));
        const existingDataCheck = await project.checkExistingDataForDataElementsToBeRemoved();
        loading.hide();

        switch (existingDataCheck.type) {
            case "no-values":
                return save();
            case "with-values":
                return setExistingData(existingDataCheck);
        }
    }, [save, project, snackbar, loading]);

    return (
        <React.Fragment>
            <ExitWizardButton
                isOpen={dialogOpen}
                onConfirm={onCancel}
                onCancel={() => setDialogOpen(false)}
            />
            {existingData && (
                <ExistingDataValuesDialog
                    onClose={closeExistingDataDialog}
                    project={project}
                    existingData={existingData}
                    onSend={saveAndSendExistingDataMessage}
                />
            )}

            <div className={classes.wrapper}>
                <NodeList nodes={projectInfo2} />

                <Button onClick={() => setDialogOpen(true)} variant="contained">
                    {i18n.t("Cancel")}
                </Button>

                <Button
                    className={classes.saveButton}
                    onClick={checkExistingDataAndSave}
                    variant="contained"
                    disabled={isSaving}
                >
                    {i18n.t("Save")}
                </Button>

                <pre>{errorMessage}</pre>
            </div>
        </React.Fragment>
    );
};

const NodeList: React.FC<{ nodes: ProjectInfoNode[] }> = props => {
    const { nodes } = props;

    return (
        <ul>
            {nodes.map(node => {
                switch (node.type) {
                    case "field":
                        return (
                            <LiEntry
                                label={node.name}
                                value={node.value}
                                prevValue={node.prevValue}
                                action={node.action}
                            />
                        );
                    case "value":
                        return (
                            <LiEntry
                                label={undefined}
                                value={node.value}
                                prevValue={node.prevValue}
                                action={node.action}
                            />
                        );
                    case "section":
                        return (
                            <LiEntry label={node.title} value={undefined} action={node.action}>
                                <NodeList nodes={node.children} />
                            </LiEntry>
                        );
                }
            })}
        </ul>
    );
};

interface LiEntryProps {
    label: Maybe<string>;
    value?: string;
    prevValue?: Maybe<string>;
    action: Maybe<Action>;
}

const LiEntry: React.FC<LiEntryProps> = props => {
    const { label, value, prevValue, action, children } = props;
    const actionNames = ProjectInfo.getActionNames();

    return (
        <li key={label}>
            {label && (
                <>
                    <b>{label}</b>:&nbsp;
                </>
            )}
            {action && action !== "none" && <i>[{actionNames[action]}]&nbsp;</i>}
            {prevValue !== undefined && prevValue !== value && <span>{prevValue} ➔ </span>}
            {value}
            {children}
        </li>
    );
};

function useSave(project: Project, action: StepProps["action"]) {
    const { api, isDev, isTest, appConfig, currentUser } = useAppContext();
    const [isSaving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const snackbar = useSnackbar();
    const history = useHistory();
    const loading = useLoading();

    const save = React.useCallback(async () => {
        try {
            loading.show(true, i18n.t("Saving Project"));
            setSaving(true);
            const { payload, response, project: projectSaved } = await project.save();
            setSaving(false);

            if (response && response.status === "OK") {
                const notificator = new ProjectNotification(
                    api,
                    appConfig,
                    projectSaved,
                    currentUser,
                    isTest
                );
                notificator.notifyOnProjectSave(action);
                const baseMsg =
                    action === "create" ? i18n.t("Project created") : i18n.t("Project updated");
                const msg = `${baseMsg}: ${projectSaved.name}`;
                history.push(generateUrl("projects"));
                if (isDev) saveDataValues(api, projectSaved);
                snackbar.success(msg);
            } else {
                setErrorMessage(JSON.stringify({ response, payload }, null, 2));
            }
            loading.hide();
        } catch (err: any) {
            setSaving(false);
            loading.hide();
            console.error(err);
            snackbar.error(err.message || err.toString());
        }
    }, [
        project,
        setSaving,
        history,
        snackbar,
        action,
        api,
        appConfig,
        isDev,
        currentUser,
        isTest,
        loading,
    ]);

    return { isSaving, errorMessage, save };
}

export default React.memo(SaveStep);

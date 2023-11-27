import _ from "lodash";
import React from "react";

import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import { AttachFiles } from "../steps/attach-files/AttachFiles";
import Project from "../../models/Project";
import { ProjectDocument } from "../../models/ProjectDocument";
import { useAppContext } from "../../contexts/api-context";
import { useLoading, useSnackbar } from "@eyeseetea/d2-ui-components";

import { Maybe } from "../../types/utils";
import i18n from "./../../locales";

type AttachFilesDialogProps = {
    projectId: Maybe<string>;
    onClose: () => void;
};

export const AttachFilesDialog: React.FC<AttachFilesDialogProps> = props => {
    const { api, config } = useAppContext();
    const loading = useLoading();
    const snackbar = useSnackbar();
    const { onClose, projectId } = props;
    const [documents, setDocuments] = React.useState<ProjectDocument[]>();
    const [projectDetails, setProjectDetails] = React.useState<Project>();

    React.useEffect(() => {
        async function fetchProject() {
            if (projectId) {
                const project = await Project.get(api, config, projectId);
                setProjectDetails(project);
            }
        }

        fetchProject();
    }, [api, config, projectId]);

    if (!projectDetails) return null;

    const onChangeProject = (projectDocuments: ProjectDocument[]) => {
        setDocuments(projectDocuments);
    };

    const onSaveProject = async () => {
        if (!documents) {
            onClose();
            return;
        }
        loading.show(true, i18n.t("Validating Project"));
        const newProject = projectDetails.setObj({ documents });
        const validation = await newProject.validate(["documents"]);
        const error = _(validation).values().flatten().join("\n");
        if (error) {
            snackbar.error(error);
            loading.hide();
            return;
        }

        loading.show(true, i18n.t("Saving Project"));
        try {
            await newProject.saveFiles();
            snackbar.success(i18n.t("Project updated"));
            onClose();
        } catch (err: any) {
            const message = err?.response?.data?.message || i18n.t("Unknown error");
            snackbar.error(i18n.t("Error uploading files: {{message}}", { message }));
        } finally {
            loading.hide();
        }
    };

    return (
        <Dialog onClose={onClose} open maxWidth={"lg"}>
            <DialogTitle>
                {i18n.t("Files")} - {`${projectDetails.name} (${projectDetails.code})`}
            </DialogTitle>
            <DialogContent>
                <AttachFiles onChange={onChangeProject} project={projectDetails} />
                <DialogActions>
                    <Button onClick={onClose}>{i18n.t("Cancel")}</Button>
                    <Button color="primary" variant="contained" onClick={onSaveProject}>
                        {i18n.t("Save")}
                    </Button>
                </DialogActions>
            </DialogContent>
        </Dialog>
    );
};

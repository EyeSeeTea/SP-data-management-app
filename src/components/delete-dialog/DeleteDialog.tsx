import React from "react";
import { Id } from "../../types/d2-api";
import { withSnackbarOnError } from "../utils/errors";
import { useSnackbar, ConfirmationDialog } from "@eyeseetea/d2-ui-components";
import Project from "../../models/Project";
import { useAppContext } from "../../contexts/api-context";
import i18n from "../../locales";
import { LinearProgress } from "@material-ui/core";

interface DeleteDialogProps {
    onClose(): void;
    projectIds: Id[];
}

const DeleteDialog: React.FunctionComponent<DeleteDialogProps> = props => {
    const snackbar = useSnackbar();
    const { api, config } = useAppContext();
    const { onClose, projectIds } = props;
    const [isDeleting, setDeleting] = React.useState(false);

    const deleteProject = React.useCallback(() => {
        setDeleting(true);
        withSnackbarOnError(
            snackbar,
            async () => {
                await Project.delete(config, api, projectIds);
                snackbar.success(i18n.t("{{n}} projects deleted", { n: projectIds.length }));
            },
            { onFinally: onClose }
        );
    }, [api, config, onClose, projectIds, snackbar]);

    return (
        <ConfirmationDialog
            isOpen={true}
            onSave={deleteProject}
            onCancel={isDeleting ? undefined : onClose}
            title={i18n.t("Delete project")}
            description={i18n.t(
                "This operation will delete the organisation units, data sets and dashboards associated with the selected projects ({{n}}). This operation cannot be undone. Are you sure you want to proceed?",
                { n: projectIds.length }
            )}
            saveText={isDeleting ? i18n.t("Deleting...") : i18n.t("Proceed")}
            disableSave={isDeleting}
            cancelText={i18n.t("Cancel")}
        >
            {isDeleting && <LinearProgress />}
        </ConfirmationDialog>
    );
};

export default DeleteDialog;

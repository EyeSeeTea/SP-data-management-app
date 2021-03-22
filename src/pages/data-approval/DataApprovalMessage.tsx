import React from "react";
import _ from "lodash";
import { ConfirmationDialog, useSnackbar } from "@eyeseetea/d2-ui-components";
import i18n from "../../locales";
import { TextField } from "@material-ui/core";
import { Maybe } from "../../types/utils";
import { useDataApprovalMessage } from "./data-approval-hooks";
import Project from "../../models/Project";

export interface DataApprovalMessageProps {
    onClose: () => void;
    project: Maybe<Project>;
    dataSetType: Maybe<"actual" | "target">;
    period: Maybe<string>;
}

type Event = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

export type User = { name: string; username: string; id: string };

export const DataApprovalMessage: React.FC<DataApprovalMessageProps> = props => {
    const { onClose, project, dataSetType, period } = props;
    const { users, onSend } = useDataApprovalMessage(project, dataSetType, period);
    const [body, setBody] = React.useState("");
    const snackbar = useSnackbar();
    const [isSending, setIsSending] = React.useState(false);
    const setBodyFromEvent = React.useCallback((ev: Event) => setBody(ev.target.value), [setBody]);

    const sendMessage = React.useCallback(() => {
        if (users) {
            setIsSending(true);
            onSend(users, body)
                .then(() => {
                    snackbar.success(i18n.t("Message sent"));
                    onClose();
                })
                .catch((err: any) => {
                    snackbar.error(err ? err.message || err.toString() : "Unknown error");
                })
                .finally(() => {
                    setIsSending(false);
                });
        }
    }, [setIsSending, onSend, onClose, snackbar, users, body]);

    return (
        <ConfirmationDialog
            isOpen={true}
            fullWidth={true}
            maxWidth="md"
            onSave={sendMessage}
            disableSave={_.isEmpty(users) || !body || isSending}
            onCancel={onClose}
            title={i18n.t("Send message to users that have introduced data for this month")}
            saveText={isSending ? i18n.t("Sending...") : i18n.t("Send")}
            cancelText={i18n.t("Cancel")}
        >
            {!users ? (
                i18n.t("Loading...")
            ) : _.isEmpty(users) ? (
                i18n.t("There is no data for this month")
            ) : (
                <React.Fragment>
                    <div style={{ marginBottom: 10 }}>
                        {i18n.t("List of users")}:
                        {
                            <ul style={{ textDecoration: "none", marginLeft: 30 }}>
                                {users.map(user => (
                                    <li key={user.id}>
                                        {user.name} ({user.username})
                                    </li>
                                ))}
                            </ul>
                        }
                    </div>

                    <TextField
                        disabled={_.isEmpty(users) || isSending}
                        value={body}
                        multiline={true}
                        rows={1}
                        rowsMax={10}
                        fullWidth={true}
                        onChange={setBodyFromEvent}
                        placeholder={i18n.t("Message")}
                    />
                </React.Fragment>
            )}
        </ConfirmationDialog>
    );
};

import React from "react";
import { ConfirmationDialog } from "@eyeseetea/d2-ui-components";
import { makeStyles } from "@material-ui/core";

import Project from "../../../models/Project";
import i18n from "../../../locales";
import TextFieldOnBlur from "../../../pages/report/TextFieldOnBlur";
import { ExistingData } from "../../../models/ProjectDb";

interface ExistingDataValuesDialogProps {
    project: Project;
    existingData: ExistingData;
    onClose(): void;
    onSend(message: string): void;
}

const ExistingDataValuesDialog: React.FunctionComponent<ExistingDataValuesDialogProps> = props => {
    const { onClose, onSend, existingData } = props;
    const [message, setMessage] = React.useState("");

    const notifySend = React.useCallback(async () => {
        onSend(message);
    }, [onSend, message]);

    const [messageIsValid, setMessageIsValid] = React.useState(false);

    const updateSaveButtonState = React.useCallback((message: string) => {
        setMessageIsValid(message !== "");
    }, []);

    const classes = useStyles();

    return (
        <ConfirmationDialog
            isOpen={true}
            fullWidth
            maxWidth="md"
            onSave={notifySend}
            onCancel={onClose}
            title={i18n.t("Data found for indicators to be removed from the project")}
            saveText={i18n.t("Save Project")}
            disableSave={!messageIsValid}
            cancelText={i18n.t("Cancel")}
        >
            <div>
                {i18n.t(
                    "There are data for indicators that are about to be removed from the project:"
                )}
                <ul>
                    {existingData.dataElementsWithData.map(dataElement => (
                        <li key={dataElement.id}>
                            [{dataElement.sector.name}] [{dataElement.code}] {dataElement.name}
                        </li>
                    ))}
                </ul>
                {i18n.t("Before saving, please explain why these indicators have been removed")}:
                <div className={classes.textField}>
                    <TextFieldOnBlur
                        value={message}
                        onChange={updateSaveButtonState}
                        onBlurChange={setMessage}
                        multiline
                        fullWidth
                        rows={4}
                        rowsMax={10}
                    />
                </div>
            </div>
        </ConfirmationDialog>
    );
};

const useStyles = makeStyles(() => ({
    textField: {
        marginTop: 20,
        border: "1px solid #EEE",
        paddingRight: 15,
    },
}));

export default React.memo(ExistingDataValuesDialog);

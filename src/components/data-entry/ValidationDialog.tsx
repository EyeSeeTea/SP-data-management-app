import React from "react";
import _ from "lodash";
import { ConfirmationDialog } from "@eyeseetea/d2-ui-components";
import i18n from "../../locales";
import InfoIcon from "@material-ui/icons/Info";
import WarningIcon from "@material-ui/icons/Warning";
import ErrorIcon from "@material-ui/icons/Error";
import { SvgIconProps } from "@material-ui/core";

interface ValidationResult {
    info?: string[];
    warning?: string[];
    error?: string[];
}

interface ValidationDialogProps {
    result: ValidationResult;
    onClose: () => void;
}

export const ValidationDialog: React.FC<ValidationDialogProps> = props => {
    const { info, warning, error } = props.result;
    const isOpen = _([info, warning, error]).some(entry => (entry ? entry.length > 0 : false));

    return (
        <ConfirmationDialog
            isOpen={isOpen}
            maxWidth="lg"
            fullWidth={true}
            onCancel={props.onClose}
            title={i18n.t("Validation results")}
            cancelText={i18n.t("OK")}
        >
            <Entry texts={info} icon={InfoIcon} color="green" />
            <Entry texts={warning} icon={WarningIcon} color="orange" />
            <Entry texts={error} icon={ErrorIcon} color="red" />
        </ConfirmationDialog>
    );
};

type MuiIcon = (props: SvgIconProps) => JSX.Element;

interface EntryProps {
    icon: MuiIcon;
    color: string;
    texts?: string[];
}

const Entry: React.FC<EntryProps> = props => {
    const { icon: Icon, color, texts = [] } = props;

    return (
        <React.Fragment>
            {texts.map((text, idx) => (
                <div key={idx} style={styles.div}>
                    <Icon style={{ fill: color, marginRight: 5 }} />
                    {text}
                </div>
            ))}
        </React.Fragment>
    );
};

const styles = {
    div: { display: "flex", alignItems: "center", margin: 10 },
};

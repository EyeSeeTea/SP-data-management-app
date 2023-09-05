import React from "react";
import _ from "lodash";
import { ConfirmationDialog, useSnackbar } from "@eyeseetea/d2-ui-components";
import i18n from "../../locales";
import InfoIcon from "@material-ui/icons/Info";
import WarningIcon from "@material-ui/icons/Warning";
import ErrorIcon from "@material-ui/icons/Error";
import { LinearProgress, SvgIconProps, TextField } from "@material-ui/core";
import {
    areAllReasonsFilled,
    groupValidationByLevels,
    Reasons,
    ValidationItem,
    ValidationResult,
} from "../../models/validators/validator-common";
import Project, { DataSetType } from "../../models/Project";
import { DataEntry } from "../../models/DataEntry";

interface ValidationDialogProps {
    project: Project;
    dataSetType: DataSetType;
    result: ValidationResult;
    onClose: () => void;
    period: string;
}

type SetReasons = React.Dispatch<React.SetStateAction<Record<string, string>>>;

export const ValidationDialog: React.FC<ValidationDialogProps> = props => {
    const { result } = props;

    const itemsByLevel = React.useMemo(() => groupValidationByLevels(result), [result]);
    const { info, warning, error: errors } = itemsByLevel;
    const isOpen = _([info, warning, errors]).some(entry => entry.length > 0);
    const showReasons = errors.some(x => x.reason);

    const [reasons, setReasons, saveReason, isSaving] = useReasons(props);
    const reasonsData = { reasons, setReasons };

    const areAllReasonsFilled_ = areAllReasonsFilled(result, reasons);

    return (
        <ConfirmationDialog
            isOpen={isOpen}
            maxWidth="lg"
            fullWidth={true}
            onCancel={props.onClose}
            title={i18n.t("Validation results")}
            cancelText={i18n.t("Close")}
            saveText={i18n.t("Save")}
            onSave={showReasons ? saveReason : undefined}
            disableSave={!areAllReasonsFilled_}
        >
            <Entry items={info} icon={InfoIcon} color="green" reasonsData={reasonsData} />
            <Entry items={warning} icon={WarningIcon} color="orange" reasonsData={reasonsData} />
            <Entry items={errors} icon={ErrorIcon} color="red" reasonsData={reasonsData} />

            {isSaving && <LinearProgress />}
        </ConfirmationDialog>
    );
};

type MuiIcon = (props: SvgIconProps) => JSX.Element;

interface EntryProps {
    icon: MuiIcon;
    color: string;
    items: ValidationItem[];
    reasonsData: { reasons: Reasons; setReasons: SetReasons };
}

const Entry: React.FC<EntryProps> = props => {
    const { icon: Icon, color, items, reasonsData } = props;
    const { reasons, setReasons } = reasonsData;

    return (
        <React.Fragment>
            {items.map((item, idx) => (
                <div key={idx} style={styles.div}>
                    <Icon style={{ fill: color, marginRight: 5 }} />

                    {item.message}

                    {item.reason && (
                        <ReasonArea
                            reason={reasons[item.reason.id] || ""}
                            setReason={value =>
                                setReasons(prev => ({ ...prev, [item.reason?.id || ""]: value }))
                            }
                        />
                    )}
                </div>
            ))}
        </React.Fragment>
    );
};

const ReasonArea: React.FC<{
    reason: string;
    setReason(reason: string): void;
}> = props => {
    const { reason, setReason } = props;

    return (
        <div>
            {i18n.t("Please justify why this validation rule is not met:")}

            <TextField
                value={reason}
                multiline={true}
                fullWidth={true}
                rows={4}
                onChange={ev => setReason(ev.target.value)}
            />
        </div>
    );
};

const styles = {
    div: { display: "flex", alignItems: "center", margin: 10 },
};

function useReasons(props: ValidationDialogProps) {
    const { result, onClose, project, dataSetType, period } = props;

    const [reasons, setReasons] = React.useState<Reasons>({});
    const snackbar = useSnackbar();
    const [isSaving, setSaving] = React.useState(false);

    const dataEntry = React.useMemo(() => {
        return new DataEntry(project.api, project, dataSetType, period);
    }, [project, dataSetType, period]);

    React.useEffect(() => {
        dataEntry.getReasonsText(result).then(setReasons);
    }, [result, dataEntry]);

    const saveReason = React.useCallback(() => {
        async function run() {
            setSaving(true);

            try {
                await dataEntry.saveReasons(reasons, result);
                snackbar.success(i18n.t("Comments saved"));
                onClose();
            } catch (err: any) {
                snackbar.error(err.toString());
            } finally {
                setSaving(false);
            }
        }

        run();
    }, [result, reasons, snackbar, dataEntry, onClose]);

    return [reasons, setReasons, saveReason, isSaving] as const;
}

import React from "react";
import { ConfirmationDialog, useSnackbar } from "d2-ui-components";
import i18n from "../locales";

type Callback = () => void;

interface UseBooleanReturn {
    value: boolean;
    isEnabled: boolean;
    isDisabled: boolean;
    set: (newValue: boolean) => void;
    toggle: Callback;
    enable: Callback;
    disable: Callback;
}

export function useBoolean(initialValue: boolean): UseBooleanReturn {
    const [currentValue, setValue] = React.useState(initialValue);

    return {
        value: currentValue,
        isEnabled: currentValue,
        isDisabled: !currentValue,
        set: setValue,
        enable: () => setValue(true),
        disable: () => setValue(false),
        toggle: () => setValue(value => !value),
    };
}

export function useConfirmation(options: {
    title: string;
    text: string;
    onConfirm: Callback;
    onCancel?: Callback;
}) {
    const { title, text, onConfirm, onCancel } = options;
    const [isOpen, setOpenState] = React.useState(false);

    const onCancel_ = React.useCallback(() => {
        setOpenState(false);
        if (onCancel) onCancel();
    }, [setOpenState, onCancel]);

    const onConfirm_ = React.useCallback(() => {
        setOpenState(false);
        onConfirm();
    }, [setOpenState, onConfirm]);

    const render = React.useMemo(() => {
        return function ConfirmationDialogHook() {
            return (
                <ConfirmationDialog
                    isOpen={isOpen}
                    onSave={onConfirm_}
                    onCancel={onCancel_}
                    title={title}
                    description={text}
                    saveText={i18n.t("Proceed")}
                    cancelText={i18n.t("Cancel")}
                />
            );
        };
    }, [isOpen, onConfirm_, onCancel_, title, text]);

    return {
        open: () => setOpenState(true),
        close: () => setOpenState(false),
        render,
    };
}

export function useSnackbarOnError(onError: Callback) {
    const snackbar = useSnackbar();
    return (err: any) => {
        snackbar.error(err.message || err.toString());
        onError();
    };
}

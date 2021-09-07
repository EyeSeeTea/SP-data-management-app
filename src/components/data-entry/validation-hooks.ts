import { Maybe } from "./../../types/utils";
import { Validator } from "./../../models/Validator";
import React from "react";
import { useAppContext } from "../../contexts/api-context";
import Project, { DataSetType } from "../../models/Project";
import { InputMsg, useDhis2EntryEvents, Options } from "./data-entry-hooks";
import { ValidationResult } from "../../models/validators/validator-common";
import { useSnackbar } from "@eyeseetea/d2-ui-components";
import i18n from "../../locales";
import { usePageExitConfirmation } from "../../utils/hooks";

export interface UseValidationResponse {
    result: ValidationResult;
    clear: () => void;
    validateOnClose: (options?: { showValidation: boolean }) => boolean;
}

export function useValidation(hookOptions: {
    iframeRef: React.RefObject<HTMLIFrameElement>;
    project: Project;
    dataSetType: DataSetType;
    period: Maybe<string>;
    options: Options;
    iframeKey: object;
    isValidationEnabled: boolean;
}): UseValidationResponse {
    const {
        iframeRef,
        project,
        dataSetType,
        period,
        options = {},
        iframeKey,
        isValidationEnabled,
    } = hookOptions;
    const { api } = useAppContext();
    const [validator, setValidator] = React.useState<Validator | undefined>();
    const snackbar = useSnackbar();

    React.useEffect(() => {
        if (period) {
            Validator.build(api, project, dataSetType, period).then(setValidator);
        }
    }, [api, project, dataSetType, period]);

    const onMessage = React.useCallback(
        (msg: InputMsg) => {
            if (!validator) {
                snackbar.warning(i18n.t("Validation data is not loaded, skip validation"));
                return Promise.resolve(true);
            }

            switch (msg.type) {
                case "preSaveDataValue":
                    return validator.validateDataValue(msg.dataValue).then(validation => {
                        setValidationResult(validation);
                        return !validation.error || validation.error.length === 0;
                    });
                case "dataValueSaved": {
                    const validatorUpdated = validator.onSave(msg.dataValue);
                    setValidator(validatorUpdated);
                }
            }
        },
        [validator, snackbar]
    );

    const [validationResult, setValidationResult] = React.useState<ValidationResult>({});
    const clearResult = React.useCallback(() => setValidationResult({}), [setValidationResult]);

    const validateOnClose = React.useCallback<UseValidationResponse["validateOnClose"]>(
        options => {
            if (!isValidationEnabled) return true;
            const { showValidation = false } = options || {};
            if (!validator) return true;
            const newValidationResult = validator.validateOnClose();
            if (showValidation) setValidationResult(newValidationResult);
            const isValid = !newValidationResult.error || newValidationResult.error.length === 0;
            return isValid;
        },
        [validator, isValidationEnabled]
    );

    const showPromptFn = React.useCallback(() => !validateOnClose(), [validateOnClose]);

    usePageExitConfirmation(showPromptFn);

    useDhis2EntryEvents(iframeRef, onMessage, options, iframeKey);

    return { result: validationResult, clear: clearResult, validateOnClose };
}

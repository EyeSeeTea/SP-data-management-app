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
import ProjectDb from "../../models/ProjectDb";

export interface UseValidationResponse {
    result: ValidationResult;
    clear: () => void;
    validate: (options?: { showValidation: boolean }) => boolean;
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
    const { api, config } = useAppContext();
    const [validator, setValidator] = React.useState<Validator | undefined>();
    const snackbar = useSnackbar();

    React.useEffect(() => {
        if (period) {
            Validator.build(api, config, project, dataSetType, period).then(setValidator);
        }
    }, [api, config, project, dataSetType, period]);

    const onMessage = React.useCallback(
        (msg: InputMsg) => {
            if (!validator) {
                snackbar.warning(i18n.t("Validation data is not loaded, skip validation"));
                return Promise.resolve(true);
            }

            switch (msg.type) {
                case "preSaveDataValue": {
                    const validatorUpdated = validator.onSave(msg.dataValue);

                    return validatorUpdated.validateDataValue(msg.dataValue).then(validation => {
                        const hasErrors = validation.error && validation.error.length > 0;
                        setValidationResult(validation);

                        if (!hasErrors) {
                            setValidator(validatorUpdated);
                            return true;
                        } else {
                            return false;
                        }
                    });
                }
                case "dataValueSaved": {
                    const projectDb = new ProjectDb(project);
                    projectDb.updateOrgUnitWithLastUpdatedData(api, config, project);
                }
            }
        },
        [validator, snackbar, project, config, api]
    );

    const [validationResult, setValidationResult] = React.useState<ValidationResult>({});
    const clearResult = React.useCallback(() => setValidationResult({}), [setValidationResult]);

    const validate = React.useCallback<UseValidationResponse["validate"]>(
        options => {
            if (!isValidationEnabled) return true;
            const { showValidation = false } = options || {};
            if (!validator) return true;
            const newValidationResult = validator.validate();
            if (showValidation) setValidationResult(newValidationResult);
            const isValid = !newValidationResult.error || newValidationResult.error.length === 0;
            return isValid;
        },
        [validator, isValidationEnabled]
    );

    const showPromptFn = React.useCallback(() => !validate({ showValidation: true }), [validate]);

    usePageExitConfirmation(showPromptFn);

    useDhis2EntryEvents(iframeRef, onMessage, options, iframeKey);

    return { result: validationResult, clear: clearResult, validate: validate };
}

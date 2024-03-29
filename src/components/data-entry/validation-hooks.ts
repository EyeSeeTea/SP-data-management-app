import { Maybe } from "./../../types/utils";
import { Validator } from "./../../models/Validator";
import React from "react";
import { useAppContext } from "../../contexts/api-context";
import Project, { DataSetType } from "../../models/Project";
import { InputMsg, useDhis2EntryEvents, Options } from "./data-entry-hooks";
import {
    DataValue,
    ValidationResult,
    validationsAreValid,
} from "../../models/validators/validator-common";
import { useSnackbar } from "@eyeseetea/d2-ui-components";
import i18n from "../../locales";
import { usePageExitConfirmation } from "../../utils/hooks";
import ProjectDb from "../../models/ProjectDb";

export interface UseValidationResponse {
    result: ValidationResult;
    clear: () => void;
    validate: (options?: { showValidation: boolean }) => Promise<boolean>;
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
            if (!period || !project.orgUnit) return;

            if (!validator) {
                snackbar.warning(i18n.t("Validation data is not loaded, skip validation"));
                return Promise.resolve(true);
            }

            const categoryOption = config.categoryOptions[dataSetType];
            const aocId = categoryOption.categoryOptionCombos.map(coc => coc.id)[0];

            const dataValue: DataValue = {
                ...msg.dataValue,
                period: period,
                orgUnitId: project.orgUnit.id,
                attributeOptionComboId: aocId,
                comment: "",
            };

            switch (msg.type) {
                case "preSaveDataValue": {
                    const validatorUpdated = validator.onSave(dataValue);

                    return validatorUpdated.validateDataValue(dataValue).then(validation => {
                        const hasErrors = validation.some(v => v.level === "error");
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
                    projectDb.updateLastUpdatedData(api, config, project);
                }
            }
        },
        [validator, snackbar, project, config, dataSetType, period, api]
    );

    const [validationResult, setValidationResult] = React.useState<ValidationResult>([]);
    const clearResult = React.useCallback(() => setValidationResult([]), [setValidationResult]);

    const validate = React.useCallback<UseValidationResponse["validate"]>(
        async options => {
            if (!isValidationEnabled) return true;
            const { showValidation = false } = options || {};
            if (!validator) return true;
            const newValidationResult = await validator.validate();
            if (showValidation) setValidationResult(newValidationResult);
            return validationsAreValid(newValidationResult);
        },
        [validator, isValidationEnabled]
    );

    const showPromptFn = React.useCallback(
        async () => !(await validate({ showValidation: true })),
        [validate]
    );

    usePageExitConfirmation(showPromptFn);

    useDhis2EntryEvents(iframeRef, onMessage, options, iframeKey);

    return { result: validationResult, clear: clearResult, validate: validate };
}

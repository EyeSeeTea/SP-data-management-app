import { Maybe } from "./../../types/utils";
import { Validator } from "./../../models/Validator";
import React from "react";
import { useAppContext } from "../../contexts/api-context";
import Project, { DataSetType } from "../../models/Project";
import { InputMsg, useDhis2EntryEvents, Options } from "./data-entry-hooks";
import { ValidationResult } from "../../models/validators/validator-common";
import { useSnackbar } from "d2-ui-components";
import i18n from "../../locales";

interface UseValidationResponse {
    result: ValidationResult;
    clear: () => void;
}

export function useValidation(
    iframeRef: React.RefObject<HTMLIFrameElement>,
    project: Project,
    dataSetType: DataSetType,
    period: Maybe<string>,
    options: Options = {}
): UseValidationResponse {
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
            if (msg.type === "preSaveDataValue") {
                if (!validator) {
                    snackbar.warning(i18n.t("Validation data is not loaded, skip validation"));
                    return Promise.resolve(true);
                } else {
                    return validator.validateDataValue(msg.dataValue).then(validation => {
                        console.log("validation", validation);
                        setValidationResult(validation);
                        return !validation.error;
                    });
                }
            }
        },
        [validator]
    );

    const [validationResult, setValidationResult] = React.useState<ValidationResult>({});
    const clearResult = React.useCallback(() => setValidationResult({}), [setValidationResult]);

    useDhis2EntryEvents(iframeRef, onMessage, options);

    return { result: validationResult, clear: clearResult };
}

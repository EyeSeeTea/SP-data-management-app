import { Maybe } from "./../../types/utils";
import { Validator, ValidationResult } from "./../../models/Validator";
import React from "react";
import { useAppContext } from "../../contexts/api-context";
import Project, { DataSet } from "../../models/Project";
import { InputMsg, useDhis2EntryEvents } from "./data-entry-hooks";

interface UseValidationResponse {
    result: ValidationResult;
    clear: () => void;
}

export function useValidation(
    iframeRef: React.RefObject<HTMLIFrameElement>,
    project: Project,
    dataSet: DataSet,
    period: Maybe<string>
): UseValidationResponse {
    const { api } = useAppContext();
    const [validator, setValidator] = React.useState<Validator | undefined>();

    React.useEffect(() => {
        if (period) {
            Validator.build(api, project, { period, dataSetId: dataSet.id }).then(setValidator);
        }
    }, [api, project, dataSet, period]);

    const onMessage = React.useCallback(
        (msg: InputMsg) => {
            if (msg.type === "preSaveDataValue") {
                if (!validator) return true;
                const validation = validator.validateDataValue(msg.dataValue);
                console.log("validation", validation);
                setValidationResult(validation);
                return !validation.error;
            }
        },
        [validator]
    );

    /*
    const initialResult = {
        info: ["info1", "info2"],
        warning: ["warning"],
        error: ["error"],
    };
    */

    const [validationResult, setValidationResult] = React.useState<ValidationResult>({});
    const clearResult = React.useCallback(() => setValidationResult({}), [setValidationResult]);

    useDhis2EntryEvents(iframeRef, onMessage);

    return { result: validationResult, clear: clearResult };
}

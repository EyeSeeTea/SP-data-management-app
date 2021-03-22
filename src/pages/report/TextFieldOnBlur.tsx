import React from "react";
import TextField, { TextFieldProps } from "@material-ui/core/TextField";
import wrap from "word-wrap";
import { useSnackbar } from "@eyeseetea/d2-ui-components";
import i18n from "../../locales";

export type TextFieldOnBlurProps = TextFieldProps & {
    value: string;
    onBlurChange: (s: string) => void;
    maxLineChars?: number;
    maxContentRows?: number;
};

type OnBlur = NonNullable<TextFieldProps["onBlur"]>;

const TextFieldOnBlur: React.FC<TextFieldOnBlurProps> = props => {
    const snackbar = useSnackbar();
    const { onBlurChange, value, maxContentRows, maxLineChars, ...otherProps } = props;
    const [stateValue, setStateValue] = React.useState(value);

    React.useEffect(() => {
        setStateValue(value);
    }, [value]);

    const notifyChange = React.useCallback<OnBlur>(() => {
        onBlurChange(stateValue);
    }, [onBlurChange, stateValue]);

    const setStateValueFromEvent = React.useCallback<OnBlur>(
        ev => {
            const newValue = ev.target.value;
            const canChangeValue =
                newValue.length <= stateValue.length ||
                !maxContentRows ||
                wrap(newValue, { width: maxLineChars, cut: true }).split(/\n/).length <=
                    maxContentRows;

            if (canChangeValue) {
                setStateValue(newValue);
            } else {
                snackbar.warning(i18n.t("You have reached the limit for this field"), {
                    autoHideDuration: 1500,
                });
            }
        },
        [setStateValue, maxContentRows, maxLineChars, stateValue, snackbar]
    );

    return (
        <TextField
            {...otherProps}
            value={stateValue || ""}
            onChange={setStateValueFromEvent}
            onBlur={notifyChange}
        />
    );
};

export default React.memo(TextFieldOnBlur);

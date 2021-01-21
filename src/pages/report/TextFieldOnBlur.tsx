import React from "react";
import TextField, { TextFieldProps } from "@material-ui/core/TextField";
import wrap from "word-wrap";

export type TextFieldOnBlurProps = TextFieldProps & {
    value: string;
    onBlurChange: (s: string) => void;
    maxLineChars?: number;
    maxContentRows?: number;
};

type OnBlur = NonNullable<TextFieldProps["onBlur"]>;

const TextFieldOnBlur: React.FC<TextFieldOnBlurProps> = props => {
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
                wrap(newValue, { width: maxLineChars }).split(/\n/).length <= maxContentRows;

            if (canChangeValue) setStateValue(newValue);
        },
        [setStateValue, maxContentRows, maxLineChars, stateValue]
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

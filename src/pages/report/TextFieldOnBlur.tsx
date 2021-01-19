import React from "react";
import TextField, { TextFieldProps } from "@material-ui/core/TextField";

export type TextFieldOnBlurProps = TextFieldProps & {
    value: string;
    onBlurChange: (s: string) => void;
    maxContentRows?: number;
};

type OnBlur = NonNullable<TextFieldProps["onBlur"]>;

const TextFieldOnBlur: React.FC<TextFieldOnBlurProps> = props => {
    const { onBlurChange, value, maxContentRows, ...otherProps } = props;
    const [stateValue, setStateValue] = React.useState(value);

    React.useEffect(() => {
        setStateValue(value);
    }, [value]);

    const notifyChange = React.useCallback<OnBlur>(() => {
        onBlurChange(stateValue.trim());
    }, [onBlurChange, stateValue]);

    const setStateValueFromEvent = React.useCallback<OnBlur>(
        ev => {
            const value = ev.target.value;
            const canChangeValue = !maxContentRows || value.split(/\n/).length <= maxContentRows;
            if (canChangeValue) setStateValue(ev.target.value);
        },
        [setStateValue, maxContentRows]
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

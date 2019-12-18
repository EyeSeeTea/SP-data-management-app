import React from "react";
import TextField, { TextFieldProps } from "@material-ui/core/TextField";

type TextFieldOnBlurProps = TextFieldProps & {
    value: string;
    onBlurChange: (s: string) => void;
};

const TextFieldOnBlur: React.FC<TextFieldOnBlurProps> = props => {
    const { onBlurChange, value, ...otherProps } = props;

    return (
        <TextField
            {...otherProps}
            defaultValue={value}
            onBlur={ev => onBlurChange(ev.target.value)}
        />
    );
};

export default TextFieldOnBlur;

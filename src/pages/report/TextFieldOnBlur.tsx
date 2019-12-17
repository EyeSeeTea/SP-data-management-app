import React from "react";
import TextField, { TextFieldProps } from "@material-ui/core/TextField";

type TextFieldOnBlurProps = TextFieldProps & {
    value: string;
    onBlurChange: (s: string) => void;
};

const TextFieldOnBlur: React.FC<TextFieldOnBlurProps> = props => {
    const [value, setValue] = React.useState<string>(props.value);
    const { onBlurChange, ...otherProps } = props;

    return (
        <TextField
            {...otherProps}
            value={value}
            onChange={ev => setValue(ev.target.value)}
            onBlur={ev => onBlurChange(ev.target.value)}
        />
    );
};

export default TextFieldOnBlur;

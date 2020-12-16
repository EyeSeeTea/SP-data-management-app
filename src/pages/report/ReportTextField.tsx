import React from "react";
import TextFieldOnBlur from "./TextFieldOnBlur";
import { getMultilineRows } from "./utils";
import { TextFieldProps } from "@material-ui/core/TextField";

export type ReportTextFieldProps = TextFieldProps & {
    title: string;
    value: string;
    field: string;
    onBlurChange(field: string, value: string): void;
};

const ReportTextField: React.FC<ReportTextFieldProps> = props => {
    const { title, field, value, onBlurChange, ...otherProps } = props;
    const notifyChange = React.useCallback(
        (value: string) => {
            onBlurChange(field, value);
        },
        [onBlurChange, field]
    );

    return (
        <div style={{ marginTop: 10, marginBottom: 10, padding: 10 }}>
            <div style={{ fontSize: "1.1em", color: "grey", marginTop: 10, marginBottom: 10 }}>
                {title}
            </div>

            <TextFieldOnBlur
                value={value}
                multiline={true}
                fullWidth={true}
                style={{ border: "1px solid #EEE" }}
                rows={getMultilineRows(value, 4, 10)}
                rowsMax={10}
                onBlurChange={notifyChange}
                InputProps={{ style: { margin: 10 } }}
                {...otherProps}
            />
        </div>
    );
};

export default React.memo(ReportTextField);

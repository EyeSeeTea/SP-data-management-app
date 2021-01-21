import React from "react";
import TextFieldOnBlur from "./TextFieldOnBlur";
import { getMultilineRows } from "./utils";
import { TextFieldProps } from "@material-ui/core/TextField";

export type ReportTextFieldProps = TextFieldProps & {
    title: string;
    value: string | undefined;
    field: string;
    minVisibleRows?: number;
    maxVisibleRows?: number;
    maxContentRows?: number;
    maxLineChars?: number;
    onBlurChange(field: string, value: string): void;
};

const ReportTextField: React.FC<ReportTextFieldProps> = props => {
    const {
        title,
        field,
        value,
        onBlurChange,
        children,
        minVisibleRows = 4,
        maxVisibleRows = 10,
        ...otherProps
    } = props;

    const notifyChange = React.useCallback((value: string) => onBlurChange(field, value), [
        onBlurChange,
        field,
    ]);

    return (
        <div style={styles.main}>
            <div style={styles.title}>
                {title}
                {children}
            </div>

            <TextFieldOnBlur
                value={value || ""}
                disabled={value === undefined}
                multiline={true}
                fullWidth={true}
                style={styles.textField}
                rows={getMultilineRows(value, minVisibleRows, maxVisibleRows)}
                rowsMax={maxVisibleRows}
                onBlurChange={notifyChange}
                InputProps={styles.inputProps}
                {...otherProps}
            />
        </div>
    );
};

const styles = {
    main: { marginTop: 10, marginBottom: 10, padding: 10, width: "1050px" },
    title: { fontSize: "1.1em", color: "grey", marginTop: 10, marginBottom: 10 },
    textField: { border: "1px solid #EEE" },
    inputProps: { style: { margin: 10 } },
};

export default React.memo(ReportTextField);

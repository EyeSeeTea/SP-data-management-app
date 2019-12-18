import React from "react";
import TextFieldOnBlur from "./TextFieldOnBlur";
import { getMultilineRows } from "./utils";

interface MultilineTextFieldProps {
    title: string;
    value: string;
    onChange(value: string): void;
}

const MultilineTextField: React.FC<MultilineTextFieldProps> = ({ title, value, onChange }) => {
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
                onBlurChange={onChange}
            />
        </div>
    );
};

export default MultilineTextField;

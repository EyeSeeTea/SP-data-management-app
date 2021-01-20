import React from "react";
import { DataElementMER, ProjectForMer, DataElementInfo } from "../../models/MerReport";
import TextFieldOnBlur, { TextFieldOnBlurProps } from "./TextFieldOnBlur";
import { getMultilineRows } from "./utils";

export interface CommentFieldProps {
    dataElement: DataElementMER;
    onChange(project: ProjectForMer, dataElement: DataElementInfo, value: string): void;
}

const CommentField: React.FC<CommentFieldProps> = props => {
    const { dataElement, onChange } = props;
    const rows = React.useMemo(() => {
        return getMultilineRows(dataElement.comment, 1, 4);
    }, [dataElement.comment]);

    const notifyChange = React.useCallback<TextFieldOnBlurProps["onBlurChange"]>(
        value => {
            onChange(dataElement.project, dataElement, value);
        },
        [onChange, dataElement]
    );

    return (
        <TextFieldOnBlur
            value={dataElement.comment}
            fullWidth={true}
            multiline={true}
            rows={rows}
            rowsMax={4}
            onBlurChange={notifyChange}
        />
    );
};

export default React.memo(CommentField);

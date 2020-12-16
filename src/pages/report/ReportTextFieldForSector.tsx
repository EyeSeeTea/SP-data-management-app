import React from "react";
import { Ref } from "../../types/d2-api";
import ReportTextField, { ReportTextFieldProps } from "./ReportTextField";

export type ReportTextFieldForSectorProps = ReportTextFieldProps & {
    sector: Ref;
    onBlurChange(field: string, value: object): void;
    parent: object;
};

export const ReportTextFieldForSector: React.FC<ReportTextFieldForSectorProps> = props => {
    const { sector, parent, onBlurChange, ...otherProps } = props;

    const notifyChange = React.useCallback(
        (field: string, value: string) => {
            const mergedValue = { ...parent, [sector.id]: value };
            onBlurChange(field, mergedValue);
        },
        [onBlurChange, parent, sector]
    );

    return <ReportTextField {...otherProps} onBlurChange={notifyChange} />;
};

export default React.memo(ReportTextFieldForSector);

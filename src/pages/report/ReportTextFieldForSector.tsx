import React from "react";
import _ from "lodash";
import { Id } from "../../types/d2-api";
import ReportTextField, { ReportTextFieldProps } from "./ReportTextField";
import i18n from "../../locales";
import Dropdown, { DropdownProps } from "../../components/dropdown/Dropdown";
import { reactMemo } from "../../utils/react";

export type ReportTextFieldForSectorProps<Value> = Omit<ReportTextFieldProps, "onBlurChange"> & {
    sectors: Array<{ id: Id; displayName: string }>;
    sector?: { id: Id; displayName: string };
    onSectorChange(index: number, sectorId: Id | undefined): void;
    onBlurChange(field: string, value: Value): void;
    parent: Value;
    index: number;
};

export function ReportTextFieldForSector<Value>(props: ReportTextFieldForSectorProps<Value>) {
    const { sector, parent, onBlurChange, sectors, onSectorChange, index, ...otherProps } = props;

    const notifyChange = React.useCallback(
        (field: string, value: string) => {
            if (sector) {
                const mergedValue = { ...parent, [sector.id]: value };
                onBlurChange(field, mergedValue);
            }
        },
        [onBlurChange, parent, sector]
    );

    const sectorItems = React.useMemo(() => {
        return _(sectors)
            .sortBy(sector => sector.displayName)
            .map(sector => ({
                value: sector.id,
                text: sector.displayName,
            }))
            .value();
    }, [sectors]);

    const notifySectorChange = React.useCallback<DropdownProps["onChange"]>(
        (sectorId: string | undefined) => {
            onSectorChange(index, sectorId);
        },
        [index, onSectorChange]
    );

    return (
        <ReportTextField
            {...otherProps}
            minVisibleRows={3}
            maxVisibleRows={3}
            maxContentRows={3}
            onBlurChange={notifyChange}
        >
            <span style={styles.dropdown}>
                <Dropdown
                    label={i18n.t("Sector")}
                    items={sectorItems}
                    value={sector?.id}
                    onChange={notifySectorChange}
                    hideLabelWhenValueSelected
                />
            </span>
        </ReportTextField>
    );
}

const styles = {
    dropdown: { display: "inline-grid" },
};

export default reactMemo(ReportTextFieldForSector);

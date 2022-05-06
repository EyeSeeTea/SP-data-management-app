import React from "react";
import { useSnackbar } from "@eyeseetea/d2-ui-components";
import _ from "lodash";
import {
    Table,
    TableRow,
    TableHead,
    TableCell,
    TableBody,
    LinearProgress,
    TextFieldProps,
} from "@material-ui/core";

import MerReport, {
    staffKeys,
    StaffKey,
    StaffInfo,
    getStaffTranslations,
    StaffSummary,
} from "../../models/MerReport";
import i18n from "../../locales";
import TextFieldOnBlur, { TextFieldOnBlurProps } from "./TextFieldOnBlur";

interface StaffTableProps {
    merReport: MerReport;
    onChange(merReport: MerReport): void;
}

const StaffTable: React.FC<StaffTableProps> = props => {
    const { merReport, onChange } = props;
    const { date, organisationUnit } = merReport.data;
    const translations = React.useMemo(() => getStaffTranslations(), []);

    const onTimeChange = React.useCallback(
        (staffKey: StaffKey, staffInfo: StaffInfo) => {
            onChange(merReport.setStaffHours(staffKey, staffInfo));
        },
        [merReport, onChange]
    );

    const staffTotals = React.useMemo(() => merReport.getStaffTotals(), [merReport]);

    if (!date || !organisationUnit) return null;
    if (!merReport || !merReport.data.projectsData) return <LinearProgress />;

    return (
        <Table style={{ width: "40vw" }}>
            <TableHead>
                <TableRow>
                    <TableCell style={{ width: "10em" }}></TableCell>
                    <TableCell style={{ width: "3em" }}>{i18n.t("Full-time")}</TableCell>
                    <TableCell style={{ width: "3em" }}>{i18n.t("Part-time")}</TableCell>
                    <TableCell style={{ width: "3em" }}>{i18n.t("Total")}</TableCell>
                </TableRow>
            </TableHead>

            <TableBody>
                {staffKeys.map(staffKey => {
                    const staff = merReport.data.staffSummary;
                    const values = _(staff).get(staffKey, null);
                    const total = values ? (values.fullTime || 0) + (values.partTime || 0) : 0;
                    return (
                        <TableRow key={staffKey}>
                            <TableCell>{translations[staffKey]}</TableCell>
                            <TableCell>
                                <StaffField
                                    staff={staff}
                                    staffKey={staffKey}
                                    timeKey="fullTime"
                                    onChange={onTimeChange}
                                />
                            </TableCell>
                            <TableCell>
                                <StaffField
                                    staff={staff}
                                    staffKey={staffKey}
                                    timeKey="partTime"
                                    onChange={onTimeChange}
                                />
                            </TableCell>
                            <TableCell>{total}</TableCell>
                        </TableRow>
                    );
                })}
                <TableRow>
                    <TableCell>
                        <strong>{i18n.t("Total")}</strong>
                    </TableCell>
                    <TableCell>{staffTotals.fullTime}</TableCell>
                    <TableCell>{staffTotals.partTime}</TableCell>
                    <TableCell>{staffTotals.total}</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    );
};

const StaffField: React.FC<{
    staff: StaffSummary;
    staffKey: StaffKey;
    timeKey: keyof StaffInfo;
    onChange: (key: StaffKey, staff: StaffInfo) => void;
}> = props => {
    const { staff, staffKey: key, timeKey, onChange } = props;
    const values = _(staff).get(key, null);
    const value = values ? values[timeKey] : null;
    const snackbar = useSnackbar();

    const setValue = React.useCallback<TextFieldOnBlurProps["onBlurChange"]>(
        strValue => {
            const value = parseFloat(strValue);

            if (value < 0) {
                snackbar.error(i18n.t("Value must be zero or positive"), {
                    autoHideDuration: 1000,
                });
                return false; // Reset to previous valid value
            } else {
                const newValues = { ...staff[key], [timeKey]: strValue ? value : null };
                onChange(key, newValues);
            }
        },
        [onChange, staff, key, timeKey, snackbar]
    );

    return (
        <TextFieldOnBlur
            value={_.isNil(value) ? "" : value.toString()}
            type="number"
            onBlurChange={setValue}
            InputProps={inputProps}
        />
    );
};

const inputProps: TextFieldProps["InputProps"] = { inputProps: { min: 0 } };

export default React.memo(StaffTable);

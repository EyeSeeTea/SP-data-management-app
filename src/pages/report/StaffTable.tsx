import React from "react";
import {
    Table,
    TableRow,
    TableHead,
    TableCell,
    TableBody,
    LinearProgress,
} from "@material-ui/core";

import MerReport, {
    staffKeys,
    StaffKey,
    StaffInfo,
    getStaffTranslations,
    StaffSummary,
} from "../../models/MerReport";
import i18n from "../../locales";
import TextFieldOnBlur from "./TextFieldOnBlur";

interface StaffTableProps {
    merReport: MerReport;
    onChange(merReport: MerReport): void;
}

const StaffTable: React.FC<StaffTableProps> = props => {
    const { merReport, onChange } = props;
    const { date, organisationUnit } = merReport.data;
    if (!date || !organisationUnit) return null;
    const translations = React.useMemo(() => getStaffTranslations(), []);

    function onTimeChange(staffKey: StaffKey, staffInfo: StaffInfo): void {
        onChange(merReport.setStaffHours(staffKey, staffInfo));
    }

    if (!merReport || !merReport.data.projectsData) return <LinearProgress />;
    const staffTotals = React.useMemo(() => merReport.getStaffTotals(), [
        merReport.data.staffSummary,
    ]);

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
                    const total = (staff[staffKey].fullTime || 0) + (staff[staffKey].partTime || 0);
                    return (
                        <TableRow key={staffKey}>
                            <TableCell>{translations[staffKey]}</TableCell>
                            <TableCell>
                                <TimeTextField
                                    staff={staff}
                                    staffKey={staffKey}
                                    timeKey="fullTime"
                                    onChange={onTimeChange}
                                />
                            </TableCell>
                            <TableCell>
                                <TimeTextField
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

const TimeTextField: React.FC<{
    staff: StaffSummary;
    staffKey: StaffKey;
    timeKey: keyof StaffInfo;
    onChange: (key: StaffKey, staff: StaffInfo) => void;
}> = ({ staff, staffKey: key, timeKey, onChange }) => {
    return (
        <TextFieldOnBlur
            value={staff[key][timeKey].toString()}
            type="number"
            onBlurChange={value => onChange(key, { ...staff[key], [timeKey]: parseFloat(value) })}
        />
    );
};

export default StaffTable;

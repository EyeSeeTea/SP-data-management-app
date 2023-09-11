import _ from "lodash";
import moment from "moment";
import { DataValueSetsDataValue } from "../../types/d2-api";
import { fromPairs } from "../../types/utils";
import { Config } from "../Config";
import { monthFormat } from "../Project";

export interface DataValue {
    period: string;
    orgUnitId: string;
    dataElementId: string;
    categoryOptionComboId: string;
    attributeOptionComboId: string;
    value: string;
    comment: string;
}

export type ValidationItem = {
    level: ValidationLevel;
    message: string;
    reason?: {
        id: string;
        project: { id: string };
        dataElementId: string;
        period: string;
    };
};

export function validationsAreValid(items: ValidationItem[]): boolean {
    return items.every(item => item.level !== "error");
}

export type ValidationResult = ValidationItem[];

export const levels = ["info", "warning", "error"] as const;

export type ValidationLevel = typeof levels[number];

export function isSuperset<T>(xs: T[], ys: T[]) {
    return _.difference(ys, xs).length === 0;
}

export function toFloat(s: string): number {
    return parseFloat(s) || 0.0;
}

export function getKey(dataElementId: string, categoryOptionComboId: string) {
    return [dataElementId, categoryOptionComboId].join("-");
}

export function formatPeriod(period: string): string {
    return moment(period, monthFormat).format("MMMM YYYY");
}

export function getDataValueFromD2(d2DataValue: DataValueSetsDataValue): DataValue {
    return {
        orgUnitId: d2DataValue.orgUnit,
        period: d2DataValue.period,
        dataElementId: d2DataValue.dataElement,
        categoryOptionComboId: d2DataValue.categoryOptionCombo,
        attributeOptionComboId: d2DataValue.attributeOptionCombo,
        value: d2DataValue.value,
        comment: d2DataValue.comment,
    };
}

export function groupValidationByLevels(result: ValidationResult) {
    return fromPairs(
        levels.map(
            level =>
                [level, result.filter(item => item.level === level)] as [
                    ValidationLevel,
                    ValidationItem[]
                ]
        )
    );
}

export function areAllReasonsFilled(result: ValidationResult, reasons: Reasons) {
    return _(result)
        .map(x => x.reason?.id)
        .compact()
        .every(id => Boolean(reasons[id]));
}

export function getReasonCocId(config: Config): string {
    return config.categoryOptionCombos.newMale.id;
}

export type ReasonId = string;

export type Reason = { text: string; upToDate: boolean };
export type Reasons = Record<ReasonId, Reason["text"]>;
export type ReasonsState = Record<ReasonId, Reason>;

export function getReasonId(options: { period: string; dataElementId: string }): string {
    return [options.period, options.dataElementId].join(".");
}

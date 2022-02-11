import _ from "lodash";
import moment from "moment";
import { DataValueSetsDataValue } from "../../types/d2-api";
import { monthFormat } from "../Project";

export interface DataValue {
    period: string;
    dataElementId: string;
    categoryOptionComboId: string;
    value: string;
}

export interface ValidationResult {
    info?: string[];
    warning?: string[];
    error?: string[];
}

export type ValidationLevel = keyof ValidationResult;

export type ValidationItem = [ValidationLevel, string];

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
        period: d2DataValue.period,
        dataElementId: d2DataValue.dataElement,
        categoryOptionComboId: d2DataValue.categoryOptionCombo,
        value: d2DataValue.value,
    };
}

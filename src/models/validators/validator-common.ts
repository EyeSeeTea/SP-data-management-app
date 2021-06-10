import _ from "lodash";
import moment from "moment";
import { monthFormat } from "../Project";

export interface DataValue {
    dataElementId: string;
    categoryOptionComboId: string;
    value: string;
}

export interface ValidationResult {
    info?: string[];
    warning?: string[];
    error?: string[];
}

export type ValidationItem = [keyof ValidationResult, string];

export function areSetsEqual<T>(xs: Set<T>, ys: Set<T>) {
    return xs.size === ys.size && _.every(Array.from(xs), x => ys.has(x));
}

export function isSuperset<T>(xs: Set<T>, ys: Set<T>) {
    return xs.size >= ys.size && _.every(Array.from(ys), y => xs.has(y));
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

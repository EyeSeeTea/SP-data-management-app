import moment from "moment";
import { Maybe } from "../types/utils";
import { getMonthsRange } from "../utils/date";

type Period = string;

export const monthPeriod = "YYYYMM";

export function getPeriodsFromRange(start: Maybe<Date>, end: Maybe<Date>): Period[] {
    if (!start || !end) return [];
    const months = getMonthsRange(moment(start), moment(end));
    return months.map(date => date.format(monthPeriod));
}

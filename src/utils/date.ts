import moment, { Moment } from "moment";

export function toISOString(date: Moment) {
    return date.format("YYYY-MM-DDTHH:mm:ss");
}

export function formatDateLong(inputDate: string | Date | Moment | undefined): string {
    if (!inputDate) {
        return "";
    } else {
        // Assume all dates are UTC (sufix Z), add if not found
        const inputDateUtc =
            typeof inputDate === "string" && !inputDate.endsWith("Z") ? inputDate + "Z" : inputDate;
        const date = moment(inputDateUtc);
        return date.format("YYYY-MM-DD HH:mm:ss");
    }
}

export function formatDateShort(inputDate: string | Date | Moment | undefined): string {
    if (!inputDate) {
        return "";
    } else {
        const date = moment(inputDate);
        return date.format("YYYY-MM-DD");
    }
}

export function getMonthsRange(
    startDate: Moment | undefined,
    endDate: Moment | undefined
): Moment[] {
    if (!startDate || !endDate) {
        return [];
    } else {
        const currentDate = startDate.clone();
        const outputDates: Moment[] = [];

        while (currentDate <= endDate) {
            outputDates.push(currentDate.clone());
            currentDate.add(1, "month");
        }
        return outputDates;
    }
}

export const monthFormat = "YYYYMM";

export function getPeriodIds(range: Moment[]): Array<{ id: string }> {
    return range.map(m => ({ id: m.format(monthFormat) }));
}

import moment, { Moment } from "moment";

export function toISOStringNoTZ(date: Moment) {
    return date.format("YYYY-MM-DDTHH:mm:ss");
}

export function formatDateLong(inputDate: string | Date | Moment | undefined): string {
    if (!inputDate) {
        return "";
    } else {
        const date = moment(inputDate);
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

export function getDaysRange(startDate: Moment | null, endDate: Moment | null): Moment[] {
    if (!startDate || !endDate) {
        return [];
    } else {
        const currentDate = startDate.clone();
        const outputDates: Moment[] = [];

        while (currentDate <= endDate) {
            outputDates.push(currentDate.clone());
            currentDate.add(1, "days");
        }
        return outputDates;
    }
}

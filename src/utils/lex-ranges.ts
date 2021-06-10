import _ from "lodash";

type LexValue = string;
type Ordering = "LT" | "EQ" | "GT";

function increment(value: LexValue, digits: string): LexValue {
    if (value.length === 0) {
        return digits[0];
    } else {
        const value0 = _.last(value);
        const restValue = value.slice(0, value.length - 1);

        if (value0 !== undefined && value0 !== _.last(digits)) {
            const newDigit0 = digits[digits.indexOf(value0) + 1];
            return restValue + newDigit0;
        } else {
            return increment(restValue, digits) + digits[0];
        }
    }
}

function compare(val1: LexValue, val2: LexValue): Ordering {
    if (val1 === val2) {
        return "EQ";
    } else if (val1.length > val2.length || (val1.length === val2.length && val1 > val2)) {
        return "GT";
    } else {
        return "LT";
    }
}

/* lexRange("ABC", "BB", "AAC") -> ["BB", "BC", "CA", "CB", "CC", "AAA", "AAB"] */
export function lexRange(digits: string, start: string, end: string): string[] {
    const output: string[] = [];
    let current = start;
    while (compare(current, end) === "LT") {
        output.push(current);
        current = increment(current, digits);
    }
    return output;
}

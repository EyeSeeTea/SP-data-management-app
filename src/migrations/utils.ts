import _ from "lodash";
import { Ref } from "../types/d2-api";

export function getDuplicatedIds<Obj extends Ref>(objects: Obj[]): string[] {
    return _(objects)
        .map(obj => obj.id)
        .countBy()
        .pickBy(count => count > 1)
        .keys()
        .value();
}

/* Map sequentially over T[] with an asynchronous function and return array of mapped values */
export function promiseMap<T, S>(inputValues: T[], mapper: (value: T) => Promise<S>): Promise<S[]> {
    const reducer = (acc$: Promise<S[]>, inputValue: T): Promise<S[]> =>
        acc$.then((acc: S[]) =>
            mapper(inputValue).then(result => {
                acc.push(result);
                return acc;
            })
        );
    return inputValues.reduce(reducer, Promise.resolve([]));
}

export function zeroPad(num: number, places: number) {
    const zero = places - num.toString().length + 1;
    return Array(+(zero > 0 && zero)).join("0") + num;
}

export function enumerate<T>(xs: T[]): Array<[number, T]> {
    return xs.map((x, idx) => [idx, x]);
}

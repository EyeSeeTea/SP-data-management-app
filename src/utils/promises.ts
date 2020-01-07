//@ts-ignore
import PromisePool from "async-promise-pool";

type Options = { concurrency: number };

export function runPromises<T>(
    promiseGetters: Array<() => Promise<T>>,
    options: Options = { concurrency: 1 }
): Promise<T[]> {
    const pool = new PromisePool(options);
    promiseGetters.forEach(promiseGetter => pool.add(promiseGetter));
    return pool.all();
}

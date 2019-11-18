import _ from "lodash";

declare module "lodash" {
    interface LoDashStatic {
        getOrFail<TObject extends object, TKey extends keyof TObject>(
            object: TObject,
            path: TKey | [TKey],
            message?: string
        ): TObject[TKey];
    }

    interface LoDashImplicitWrapper<TValue> {
        getOrFail<TObject extends object, TKey extends keyof TObject>(
            this: LoDashImplicitWrapper<TObject>,
            path: TKey,
            message?: string
        ): TObject[TKey];
    }
}

function getOrFail(obj: any, key: string | number, message?: string): any {
    const value = _.get(obj, key);
    if (value === undefined) {
        const maxKeys = 20;
        const keys = _.keys(obj);
        const availableKeys = [
            _.take(keys, maxKeys).join(", "),
            keys.length > maxKeys ? ` ... and ${keys.length} more` : "",
        ].join("");
        throw new Error(message || `Key '${key}' not found: ${availableKeys}`);
    } else {
        return value;
    }
}

_.mixin({ getOrFail }, { chain: false });

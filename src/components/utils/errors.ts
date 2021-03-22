import { SnackbarState } from "@eyeseetea/d2-ui-components";
import _ from "lodash";

interface Options {
    onFinally?(): void;
    onCatch?(): void;
}

export async function withSnackbarOnError<T>(
    snackbar: SnackbarState,
    fn: () => T,
    options?: Options
): Promise<T | undefined> {
    const { onCatch, onFinally } = options || {};
    try {
        return await fn();
    } catch (err) {
        const bodyMessage = err.response?.data?.message;
        console.error(err);
        if (onCatch) onCatch();
        const message = _([err.message || err?.toString(), bodyMessage])
            .compact()
            .join(" - ");
        snackbar.error(message);
    } finally {
        if (onFinally) onFinally();
    }
}

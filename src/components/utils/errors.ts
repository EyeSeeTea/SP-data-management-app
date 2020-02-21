import { SnackbarState } from "d2-ui-components/snackbar/types";

interface Options {
    onFinally?(): void;
    onCatch?(): void;
}

export async function withSnackbarOnError(snackbar: SnackbarState, fn: Function, options: Options) {
    const { onCatch, onFinally } = options;
    try {
        await fn();
    } catch (err) {
        console.error(err);
        if (onCatch) onCatch();
        snackbar.error(err.message || err.toString());
    } finally {
        if (onFinally) onFinally();
    }
}

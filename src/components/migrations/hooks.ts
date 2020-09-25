import axiosRetry from "axios-retry";
import React from "react";
import { MigrationsRunner } from "../../migrations";
import { D2Api } from "../../types/d2-api";

export type MigrationsState =
    | { type: "checking" }
    | { type: "pending"; runner: MigrationsRunner }
    | { type: "checked" };

export interface UseMigrationsResult {
    state: MigrationsState;
    onFinish: () => void;
}

export function useMigrations(api: D2Api, dataStoreNamespace: string): UseMigrationsResult {
    const [state, setState] = React.useState<MigrationsState>({ type: "checking" });
    const onFinish = React.useCallback(() => setState({ type: "checked" }), [setState]);

    React.useEffect(() => {
        runMigrations(api, dataStoreNamespace).then(setState);
    }, []);

    const result = React.useMemo(() => ({ state, onFinish }), [state, onFinish]);

    return result;
}

async function runMigrations(api: D2Api, dataStoreNamespace: string): Promise<MigrationsState> {
    axiosRetry(api.connection, { retries: 3 });

    const runner = await MigrationsRunner.init({
        api,
        debug: console.log,
        dataStoreNamespace,
    });

    if (runner.hasPendingMigrations()) {
        return { type: "pending", runner };
    } else {
        return { type: "checked" };
    }
}

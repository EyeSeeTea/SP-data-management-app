import React from "react";
import { useHistory, useLocation } from "react-router-dom";

export interface UseQueryStringsOptions<State> {
    toParams(state: State): string;
    fromParams(params: string): State;
}

export function useUrlParams<State>(options: UseQueryStringsOptions<State>) {
    const { toParams, fromParams } = options;
    const location = useLocation();
    const history = useHistory();

    const setState = React.useCallback(
        (newState: State) => {
            const search = toParams(newState);
            history.push({ search });
        },
        [toParams, history]
    );

    const state = React.useMemo(() => {
        return fromParams(location.search);
    }, [fromParams, location.search]);

    return [state, setState] as const;
}

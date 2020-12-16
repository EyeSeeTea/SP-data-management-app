import { LinearProgress } from "@material-ui/core";
import React from "react";
import { useHistory } from "react-router-dom";

export interface LoaderProps<Data> {
    state: LoaderState<Data>;
    onErrorGoTo: string;
    children(data: Data): React.ReactNode;
}

export type LoaderState<Data> =
    | { type: "loading" }
    | { type: "error" }
    | { type: "loaded"; data: Data };

export function Loader<Data>(props: LoaderProps<Data>) {
    const { state, children, onErrorGoTo } = props;
    const history = useHistory();

    React.useEffect(() => {
        if (state.type === "error") history.push(onErrorGoTo);
    }, [history, onErrorGoTo, state]);

    if (state.type === "loading") {
        return <LinearProgress />;
    } else if (state.type === "error") {
        return null;
    } else {
        return <React.Fragment>{children(state.data)}</React.Fragment>;
    }
}

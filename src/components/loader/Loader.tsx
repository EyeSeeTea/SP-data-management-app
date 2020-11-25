import { LinearProgress } from "@material-ui/core";
import React from "react";

export interface LoaderProps<Data> {
    state: LoaderState<Data>;
    children(data: Data): React.ReactNode;
}

export type LoaderState<Data> =
    | { type: "loading" }
    | { type: "error" }
    | { type: "loaded"; data: Data };

export function Loader<Data>(props: LoaderProps<Data>) {
    const { state, children } = props;

    if (state.type === "loading") {
        return <LinearProgress />;
    } else if (state.type === "error") {
        return null;
    } else {
        return <React.Fragment>{children(state.data)}</React.Fragment>;
    }
}

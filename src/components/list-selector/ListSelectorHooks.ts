import React from "react";
import { ListView } from "../list-selector/ListSelector";
import { useGoTo } from "../../router";

export function useListSelector(view: ListView) {
    const goTo = useGoTo();
    const onClick = React.useCallback(
        newView => {
            if (view !== newView) goTo(newView);
        },
        [view, goTo]
    );

    return onClick;
}

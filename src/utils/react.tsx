import React, { ReactNode } from "react";
import _ from "lodash";

export function renderJoin(nodes: ReactNode[], separator: ReactNode): ReactNode {
    return _(nodes)
        .compact()
        .flatMap((node, idx) => (idx < nodes.length - 1 ? [node, separator] : [node]))
        .map((node, idx) => <React.Fragment key={idx}>{node || "-"}</React.Fragment>)
        .value();
}

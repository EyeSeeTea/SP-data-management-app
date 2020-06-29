import React from "react";
import _ from "lodash";
import { CSSProperties } from "@material-ui/core/styles/withStyles";
import { Ref } from "../../../types/d2-api";

export function getValuesFromSelection<Option extends Ref>(
    options: Option[],
    selectedIds: string[]
) {
    return _(options)
        .keyBy(obj => obj.id)
        .at(selectedIds)
        .compact()
        .value();
}

const defaultTitleStyle = { fontSize: "1.1em", color: "grey" };

export const Title: React.FC<{ style?: CSSProperties }> = ({ style, children }) => {
    const finalStyle = style ? { ...defaultTitleStyle, ...style } : defaultTitleStyle;
    return <div style={finalStyle}>{children}</div>;
};

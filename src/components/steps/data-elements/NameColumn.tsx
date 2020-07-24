import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Tooltip from "@material-ui/core/Tooltip";

import { renderJoin } from "../../../utils/react";
import { DataElement } from "./DataElementsTable";
import { getTooltipContents } from "./table-utils";

export const NameColumn: React.FC<{ dataElement: DataElement; showGuidance: boolean }> = ({
    dataElement,
    showGuidance,
}) => {
    const dataElements = [dataElement, ...dataElement.pairedDataElements];
    const classes = useStyles();
    const tooltips = renderJoin(
        dataElements.map(dataElement =>
            showGuidance ? (
                <Tooltip
                    enterDelay={500}
                    leaveDelay={0}
                    key={dataElement.id}
                    title={
                        <div className={classes.tooltipContents}>
                            {getTooltipContents(dataElement)}
                        </div>
                    }
                    classes={{ tooltip: classes.tooltip }}
                >
                    <span>{dataElement.name}</span>
                </Tooltip>
            ) : (
                <span>{dataElement.name}</span>
            )
        ),
        <br />
    );

    return <React.Fragment>{tooltips}</React.Fragment>;
};

const useStyles = makeStyles(() => ({
    tooltip: {
        maxWidth: 800,
        border: "1px solid #dadde9",
        backgroundColor: "#616161",
    },
    tooltipContents: {
        padding: 2,
        fontSize: "1.5em",
        lineHeight: "1.3em",
        fontWeight: "normal",
    },
}));

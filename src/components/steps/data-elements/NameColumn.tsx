import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Tooltip from "@material-ui/core/Tooltip";

import { renderJoin } from "../../../utils/react";
import { DataElement } from "./DataElementsTable";
import { getTooltipContents } from "./table-utils";
import { Filter } from "./DataElementsFilters";

interface NameColumnProps {
    dataElement: DataElement;
    showGuidance: boolean;
    filter: Filter;
}

export const NameColumn: React.FC<NameColumnProps> = props => {
    const { dataElement, showGuidance, filter } = props;
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
                    <span>{getDataElementName(dataElement, filter)}</span>
                </Tooltip>
            ) : (
                <span>{getDataElementName(dataElement, filter)}</span>
            )
        ),
        <br />
    );

    return <React.Fragment>{tooltips}</React.Fragment>;
};

function getDataElementName(dataElement: DataElement, filter: Filter): string {
    const nameFromExternal = filter.external ? dataElement.externals[filter.external]?.name : null;
    return nameFromExternal || dataElement.name;
}

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

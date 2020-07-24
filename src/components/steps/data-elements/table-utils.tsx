import React from "react";
import _ from "lodash";
import { NameColumn } from "./NameColumn";
import { DataElement, SortableField } from "./DataElementsTable";
import { ReactNode } from "react";
import { SelectionInfo } from "../../../models/dataElementsSet";
import { TableState } from "d2-ui-components";
import { Id } from "../../../types/d2-api";
import i18n from "../../../locales";
import { renderJoin } from "../../../utils/react";

export const getName = _.memoize(_getName, (dataElement, arePaired, showGuidance) =>
    [dataElement.id, arePaired, showGuidance].join("-")
);

function _getName(dataElement: DataElement, _paired: boolean, showGuidance: boolean): ReactNode {
    return (
        <NameColumn key={dataElement.name} dataElement={dataElement} showGuidance={showGuidance} />
    );
}

export function getTooltipContents(dataElement: DataElement) {
    const { externalsDescription, description } = dataElement;
    return (
        <React.Fragment>
            <div>
                {dataElement.code} - {dataElement.name}
            </div>
            <br />
            {externalsDescription && (
                <div>
                    <b>{i18n.t("Externals")}: </b>
                    {externalsDescription}
                </div>
            )}
            {description && (
                <div>
                    <b>{i18n.t("Guidance")}: </b>
                    {description}
                </div>
            )}
        </React.Fragment>
    );
}

export function withPaired<Field extends keyof DataElement>(
    paired: boolean,
    field: SortableField & Field,
    mapper?: (val: DataElement[Field]) => string
) {
    const mapper_ = mapper || _.identity;
    const render = function(dataElement: DataElement, _value: ReactNode) {
        const pairedDes = dataElement.pairedDataElements;
        const values = [dataElement, ...pairedDes].map(de => mapper_(de[field]) || "-");
        // <DataTable /> uses the column node key (if present) as sorting key, so let's set it
        // to a value that performs a composite (dataElement[FIELD], dataElement.code) ordering.
        const value = dataElement[field];
        const code = dataElement.code;
        const key = value + "-" + code;
        return <React.Fragment key={key}>{renderJoin(values, <br />)}</React.Fragment>;
    };

    return _.memoize(render, dataElement => [dataElement.id, paired].join("-"));
}

export function getSelectionMessage(dataElements: DataElement[], action: string): string | null {
    return dataElements.length === 0
        ? null
        : [
              i18n.t("Those related data elements have been automatically {{action}}:", { action }),
              "",
              ...dataElements.map(de => `[${de.code}] ${de.name} (${de.indicatorType})`),
          ].join("\n");
}

export function showSelectionMessage(snackbar: any, selectionUpdate: SelectionInfo): void {
    const msg = _.compact([
        getSelectionMessage(selectionUpdate.selected || [], i18n.t("selected")),
        ...(selectionUpdate.messages || []),
    ]).join("\n\n");

    if (msg) snackbar.info(msg);
}

export function onTableChange(
    onSelectionChange: (selectedIds: Id[]) => SelectionInfo,
    snackbar: any,
    state: TableState<DataElement>
): void {
    const selectedIds = state.selection.map(de => de.id);
    const selectionInfo = onSelectionChange(selectedIds);
    if (selectionInfo) showSelectionMessage(snackbar, selectionInfo);
}

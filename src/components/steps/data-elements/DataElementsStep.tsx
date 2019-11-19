import React, { useState } from "react";
import _ from "lodash";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import DataElementsTable from "./DataElementsTable";
import Sidebar from "./Sidebar";
import { useSnackbar } from "d2-ui-components";
import i18n from "../../../locales";
import { SelectionUpdate, DataElement } from "../../../models/dataElementsSet";

function getRelatedMessage(dataElements: DataElement[], action: string): string | null {
    return dataElements.length === 0
        ? null
        : [
              i18n.t("Those related data elements have been automatically {{action}}:", { action }),
              "",
              ...dataElements.map(de => `${de.name} (${de.indicatorType})`),
          ].join("\n");
}

function showRelatedMessage(snackbar: any, selectionUpdate: SelectionUpdate): void {
    const msg = _.compact([
        getRelatedMessage(selectionUpdate.selected, i18n.t("selected")),
        getRelatedMessage(selectionUpdate.unselected, i18n.t("unselected")),
    ]).join("\n\n");

    if (msg) snackbar.info(msg);
}

const DataElementsStep: React.FC<StepProps> = ({ onChange, project }) => {
    const snackbar = useSnackbar();
    const { dataElements } = project;
    const menuItems = project.sectors.map(sector => ({
        id: sector.id,
        text: sector.displayName,
    }));
    const [sectorId, setSectorId] = useState<string | undefined>(
        menuItems.length > 0 ? menuItems[0].id : undefined
    );

    function onSelectionChange(dataElementIds: string[]) {
        const { related, project: projectUpdated } = project.updateDataElementSelection(
            dataElementIds
        );

        showRelatedMessage(snackbar, related);

        onChange(projectUpdated);
    }

    return (
        <Sidebar
            menuItems={menuItems}
            currentMenuItemId={sectorId}
            onMenuItemClick={item => setSectorId(item.id)}
            contents={
                <DataElementsTable
                    dataElements={dataElements}
                    sectorId={sectorId}
                    onSelectionChange={onSelectionChange}
                />
            }
        />
    );
};

export default DataElementsStep;

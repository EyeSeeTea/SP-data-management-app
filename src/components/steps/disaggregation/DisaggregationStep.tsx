import React from "react";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import Sidebar from "../data-elements/Sidebar";
import DataElementsTable, { FieldName } from "../data-elements/DataElementsTable";
import { Ref, Id } from "../../../types/d2-api";
import { FilterKey } from "../data-elements/DataElementsFilters";
import { DataElement } from "../../../models/dataElementsSet";
import i18n from "../../../locales";
import Dropdown, { DropdownProps } from "../../dropdown/Dropdown";
import LocalHospitalIcon from "@material-ui/icons/LocalHospital";
import NotInterestedIcon from "@material-ui/icons/NotInterested";
import Project from "../../../models/Project";
import { renderJoin } from "../../../utils/react";
import { getIds } from "../../../utils/dhis2";

const DisaggregationStep: React.FC<StepProps> = ({ project, onChange }) => {
    const menuItems = React.useMemo(
        () => project.sectors.map(sector => ({ id: sector.id, text: sector.displayName })),
        [project]
    );
    const [sectorId, setSectorId] = React.useState<string>(
        menuItems.length > 0 ? menuItems[0].id : ""
    );
    const setSector = React.useCallback((sector: Ref) => setSectorId(sector.id), [setSectorId]);
    const dataElementsSet = project.dataElementsSelection;

    const disaggregationItems = React.useMemo(() => {
        return [
            { value: "false", text: i18n.t("No") },
            { value: "true", text: i18n.t("Yes") },
        ];
    }, []);

    const setValues = React.useCallback(
        (dataElementIds: Id[], isSet: boolean) => {
            const related = dataElementsSet.getGroupForDisaggregation(sectorId, dataElementIds);
            const newDisaggregation = project.disaggregation.setCovid19(getIds(related), isSet);
            const newProject = project.setObj({ disaggregation: newDisaggregation });
            onChange(newProject);
        },
        [onChange, project]
    );

    const customColumns = React.useMemo(() => {
        return [
            {
                name: "categoryCombo" as const,
                text: i18n.t("Disaggregation"),
                sortable: true,
                getValue: function getValue(dataElement: DataElement) {
                    const values = [dataElement, ...dataElement.pairedDataElements].map(de => (
                        <div key={dataElement.id} style={{ width: 150 }}>
                            {de.categoryCombo.displayName}
                        </div>
                    ));
                    const key = dataElement.categoryCombo.id;
                    return <React.Fragment key={key}>{renderJoin(values, <></>)}</React.Fragment>;
                },
            },
            {
                name: "isCovid19" as const,
                text: i18n.t("COVID-19"),
                sortable: true,
                getValue: function getValue(dataElement: DataElement) {
                    return (
                        <Covid19Column
                            key={dataElement.categoryCombo.id + "-" + dataElement.id}
                            project={project}
                            dataElement={dataElement}
                            items={disaggregationItems}
                            onChange={setValues}
                        />
                    );
                },
            },
        ];
    }, [Covid19Column, project]);

    const actions = React.useMemo(() => {
        return [
            {
                name: "set-covid19",
                icon: <LocalHospitalIcon />,
                text: i18n.t("Add COVID-19 disaggregation"),
                multiple: true,
                onClick: (ids: Id[]) => setValues(ids, true),
                primary: false,
            },
            {
                name: "unset-covid19",
                icon: <NotInterestedIcon />,
                text: i18n.t("Remove COVID-19 disaggregation"),
                multiple: true,
                primary: false,
                onClick: (ids: Id[]) => setValues(ids, false),
            },
        ];
    }, [Covid19Column, setValues]);

    return (
        <Sidebar
            menuItems={menuItems}
            currentMenuItemId={sectorId}
            onMenuItemClick={setSector}
            contents={
                <div style={styles.wrapper}>
                    <DataElementsTable
                        dataElementsSet={dataElementsSet}
                        sectorId={sectorId}
                        onlySelected={true}
                        showGuidance={false}
                        columns={initialColumns}
                        visibleFilters={visibleFilters}
                        customColumns={customColumns}
                        actions={actions}
                    />
                </div>
            }
        />
    );
};

const Covid19Column: React.FC<{
    project: Project;
    dataElement: DataElement;
    items: DropdownProps["items"];
    onChange(dataElementId: Id[], newValue: boolean): void;
}> = props => {
    const { project, dataElement, items, onChange } = props;
    const setValue = React.useCallback(
        (newValue: string | undefined) => {
            onChange([dataElement.id], newValue === "true");
        },
        [onChange, dataElement.id]
    );

    const value = project.disaggregation.isCovid19(dataElement.id);

    return <Dropdown onChange={setValue} items={items} value={value.toString()} hideEmpty={true} />;
};

const styles = { wrapper: { width: "100%" } };

const initialColumns: FieldName[] = ["name", "code", "indicatorType", "peopleOrBenefit"];
const visibleFilters: FilterKey[] = ["indicatorType"];

export default React.memo(DisaggregationStep);

import { generateUid } from "d2/uid";
import _ from "lodash";
import Project from "./Project";
import { MetadataPayload, PartialModel, D2Dashboard, D2ReportTable } from "d2-api";
import { Category } from "./Config";
import i18n from "../locales";

export default class ProjectDashboard {
    constructor(public project: Project) {}

    generate(): Pick<MetadataPayload, "dashboards" | "reportTables"> {
        const { project } = this;
        const reportTables: Array<PartialModel<D2ReportTable>> = [
            peopleTable(project),
            targetVsActualTable(project),
        ];
        const dashboard: PartialModel<D2Dashboard> = {
            id: generateUid(),
            name: project.name,
            dashboardItems: reportTables.map(reportTable => ({
                id: generateUid(),
                type: "REPORT_TABLE",
                reportTable: { id: reportTable.id },
            })),
        };

        return { dashboards: [dashboard], reportTables };
    }
}

function getRowsInfo(categories: Category[]) {
    return {
        categoryDimensions: categories.map(category => ({
            category: { id: category.id },
            categoryOptions: category.categoryOptions.map(co => ({ id: co.id })),
        })),
        rows: [{ id: "dx" }, ...categories.map(category => ({ id: category.id }))],
        rowDimensions: ["dx", ...categories.map(category => category.id)],
    };
}

function getOrgUnitId(project: Project): string {
    const ou = project.organisationUnit;
    if (!ou) {
        throw new Error("No organisation defined for project");
    } else {
        return _.last(ou.path.split("/")) || "";
    }
}

function targetVsActualTable(project: Project): PartialModel<D2ReportTable> {
    const orgUnitId = getOrgUnitId(project);
    const dataElements = project.dataElements.get({ onlySelected: true, includePaired: true });
    const allCategories = project.config.categories;
    const categories = [allCategories.targetActual];

    return {
        id: generateUid(),
        name: `${project.name} - ` + i18n.t("PM Target vs Actual"),
        numberType: "VALUE",
        publicAccess: "rw------",
        userOrganisationUnitChildren: false,
        legendDisplayStyle: "FILL",
        hideEmptyColumns: false,
        hideEmptyRows: false,
        userOrganisationUnit: false,
        rowSubTotals: true,
        displayDensity: "NORMAL",
        completedOnly: false,
        colTotals: false,
        showDimensionLabels: true,
        sortOrder: 0,
        fontSize: "NORMAL",
        topLimit: 0,
        aggregationType: "DEFAULT",
        userOrganisationUnitGrandChildren: false,
        hideSubtitle: false,
        externalAccess: false,
        legendDisplayStrategy: "FIXED",
        colSubTotals: false,
        showHierarchy: false,
        rowTotals: true,
        cumulative: false,
        digitGroupSeparator: "SPACE",
        hideTitle: false,
        regression: false,
        skipRounding: false,
        reportParams: {
            paramGrandParentOrganisationUnit: false,
            paramReportingPeriod: false,
            paramOrganisationUnit: false,
            paramParentOrganisationUnit: false,
        },
        filterDimensions: ["ou"],
        columnDimensions: ["pe"],
        dataDimensionItems: dataElements.map(de => ({
            dataDimensionItemType: "DATA_ELEMENT",
            dataElement: { id: de.id },
        })),
        columns: [{ id: "pe" }],
        periods: project.getPeriods(),
        organisationUnits: [{ id: orgUnitId }],
        filters: [{ id: "ou" }],
        ...getRowsInfo(categories),
    };
}

function peopleTable(project: Project): PartialModel<D2ReportTable> {
    const orgUnitId = getOrgUnitId(project);
    const dataElementsPeople = project.dataElements.get({
        onlySelected: true,
        peopleOrBenefit: "people",
        includePaired: true,
    });
    const allCategories = project.config.categories;
    const categories = [allCategories.gender, allCategories.newRecurring];

    return {
        id: generateUid(),
        name: `${project.name} - ` + i18n.t("PM People Indicators Gender Breakdown"),
        publicAccess: "rw------",
        numberType: "VALUE",
        userOrganisationUnitChildren: false,
        legendDisplayStyle: "FILL",
        hideEmptyColumns: false,
        hideEmptyRows: false,
        userOrganisationUnit: false,
        rowSubTotals: false,
        displayDensity: "NORMAL",
        completedOnly: false,
        colTotals: false,
        showDimensionLabels: true,
        sortOrder: 0,
        fontSize: "NORMAL",
        topLimit: 0,
        aggregationType: "DEFAULT",
        userOrganisationUnitGrandChildren: false,
        hideSubtitle: false,
        externalAccess: false,
        legendDisplayStrategy: "FIXED",
        colSubTotals: true,
        showHierarchy: false,
        rowTotals: true,
        cumulative: false,
        digitGroupSeparator: "SPACE",
        hideTitle: false,
        regression: false,
        skipRounding: false,
        reportParams: {
            paramGrandParentOrganisationUnit: false,
            paramReportingPeriod: false,
            paramOrganisationUnit: false,
            paramParentOrganisationUnit: false,
        },
        filterDimensions: ["ou"],
        columnDimensions: ["pe"],
        dataDimensionItems: dataElementsPeople.map(de => ({
            dataDimensionItemType: "DATA_ELEMENT",
            dataElement: { id: de.id },
        })),
        columns: [{ id: "pe" }],
        periods: project.getPeriods(),
        organisationUnits: [{ id: orgUnitId }],
        filters: [{ id: "ou" }],
        ...getRowsInfo(categories),
    };
}

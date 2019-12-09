import { generateUid } from "d2/uid";
import _ from "lodash";
import Project from "./Project";
import { PartialMetadata, PartialModel, D2Dashboard, D2ReportTable } from "d2-api";
import { Category } from "./Config";
import i18n from "../locales";

export default class ProjectDashboard {
    constructor(public project: Project) {}

    generate(): Required<Pick<PartialMetadata, "dashboards" | "reportTables">> {
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
                type: "REPORT_TABLE" as const,
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

const targetVsActualTable = (project: Project) => {
    const orgUnitId = getOrgUnitId(project);
    const dataElements = project.dataElements.get({ onlySelected: true });
    const allCategories = project.config.categories;
    const categories = [allCategories.targetActual];

    return {
        id: generateUid(),
        name: `${project.name} - ` + i18n.t("PM Target vs Actual"),
        numberType: "VALUE" as const,
        publicAccess: "rw------",
        userOrganisationUnitChildren: false,
        legendDisplayStyle: "FILL" as const,
        hideEmptyColumns: false,
        hideEmptyRows: false,
        userOrganisationUnit: false,
        rowSubTotals: true,
        displayDensity: "NORMAL" as const,
        completedOnly: false,
        colTotals: false,
        showDimensionLabels: true,
        sortOrder: 0,
        fontSize: "NORMAL" as const,
        topLimit: 0,
        aggregationType: "DEFAULT" as const,
        userOrganisationUnitGrandChildren: false,
        hideSubtitle: false,
        externalAccess: false,
        legendDisplayStrategy: "FIXED" as const,
        colSubTotals: false,
        showHierarchy: false,
        rowTotals: true,
        cumulative: false,
        digitGroupSeparator: "SPACE" as const,
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
            dataDimensionItemType: "DATA_ELEMENT" as const,
            dataElement: { id: de.id },
        })),
        columns: [{ id: "pe" }],
        periods: project.getPeriods(),
        organisationUnits: [{ id: orgUnitId }],
        filters: [{ id: "ou" }],
        ...getRowsInfo(categories),
    };
};

const peopleTable = (project: Project) => {
    const orgUnitId = getOrgUnitId(project);
    const dataElementsPeople = project.dataElements.get({
        onlySelected: true,
        peopleOrBenefit: "people",
    });
    const allCategories = project.config.categories;
    const categories = [allCategories.gender, allCategories.newRecurring];

    return {
        id: generateUid(),
        name: `${project.name} - ` + i18n.t("PM People Indicators Gender Breakdown"),
        publicAccess: "rw------",
        numberType: "VALUE" as const,
        userOrganisationUnitChildren: false,
        legendDisplayStyle: "FILL" as const,
        hideEmptyColumns: false,
        hideEmptyRows: false,
        userOrganisationUnit: false,
        rowSubTotals: false,
        displayDensity: "NORMAL" as const,
        completedOnly: false,
        colTotals: false,
        showDimensionLabels: true,
        sortOrder: 0,
        fontSize: "NORMAL" as const,
        topLimit: 0,
        aggregationType: "DEFAULT" as const,
        userOrganisationUnitGrandChildren: false,
        hideSubtitle: false,
        externalAccess: false,
        legendDisplayStrategy: "FIXED" as const,
        colSubTotals: true,
        showHierarchy: false,
        rowTotals: true,
        cumulative: false,
        digitGroupSeparator: "SPACE" as const,
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
            dataDimensionItemType: "DATA_ELEMENT" as const,
            dataElement: { id: de.id },
        })),
        columns: [{ id: "pe" }],
        periods: project.getPeriods(),
        organisationUnits: [{ id: orgUnitId }],
        filters: [{ id: "ou" }],
        ...getRowsInfo(categories),
    };
};

function getOrgUnitId(project: Project): string {
    const ou = project.organisationUnit;
    if (!ou) {
        throw new Error("No organisation defined for project");
    } else {
        return _.last(ou.path.split("/")) || "";
    }
}

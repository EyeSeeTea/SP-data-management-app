import _ from "lodash";
import { Config } from "./Config";
import {
    PartialPersistedModel,
    PartialModel,
    D2Api,
    SelectedPick,
    D2OrganisationUnitSchema,
    D2DataSetSchema,
    D2OrganisationUnit,
} from "../types/d2-api";
import { D2Dashboard, D2ReportTable, Ref, D2Chart, D2DashboardItem, Id } from "../types/d2-api";
import i18n from "../locales";
import { getUid } from "../utils/dhis2";
import {
    getReportTableItem,
    getChartItem,
    positionItems,
    dimensions,
    MaybeD2Chart,
    Chart,
    toItemWidth,
    PositionItemsOptions,
    dataElementItems,
    getD2Chart,
    Table,
    MaybeD2Table,
    getD2ReportTable,
} from "./Dashboard";
import { PeopleOrBenefit } from "./dataElementsSet";
import { D2Sharing, getD2Access } from "./ProjectSharing";
import { addAttributeValueToObj, AttributeValue } from "./Attributes";

interface DataElement {
    id: Id;
    name: string;
    code: string;
    peopleOrBenefit: PeopleOrBenefit;
}

interface Country {
    id: Id;
    name: string;
    openingDate: Date | undefined;
    attributeValues: Array<{ attribute: Ref; value: string }>;
    projects: Project[];
}

interface Project {
    id: Id;
    orgUnit: Ref;
    dataElements: DataElement[];
    openingDate: Date;
}

interface Category {
    id: Id;
    categoryOptions: Ref[];
}

interface D2Country extends PartialPersistedModel<D2OrganisationUnit> {
    attributeValues: AttributeValue[];
}

export default class CountryDashboard {
    dataElements: Record<"all" | "people" | "benefit", DataElement[]>;
    categories: { new: Category; actual: Category };

    constructor(private config: Config, private d2Country: D2Country, private country: Country) {
        this.categories = {
            new: {
                id: config.categories.newRecurring.id,
                categoryOptions: [{ id: config.categoryOptions.new.id }],
            },
            actual: {
                id: config.categories.targetActual.id,
                categoryOptions: [{ id: config.categoryOptions.actual.id }],
            },
        };
        const dataElements = _(country.projects)
            .flatMap(project => project.dataElements)
            .uniqBy(dataElement => dataElement.id)
            .sortBy(dataElement => dataElement.name)
            .value();

        this.dataElements = {
            all: dataElements,
            people: dataElements.filter(de => de.peopleOrBenefit === "people"),
            benefit: dataElements.filter(de => de.peopleOrBenefit === "benefit"),
        };
    }

    static async build(api: D2Api, config: Config, countryId: Id): Promise<CountryDashboard> {
        const metadata = await getMetadata(api, countryId);
        if (!metadata) throw new Error("Cannot get metadata");

        const { orgUnit, dataSets } = metadata;

        const projects: Project[] = _(dataSets)
            .map(dataSet => getProject(config, metadata, dataSet))
            .compact()
            .value();

        const country: Country = {
            id: orgUnit.id,
            name: orgUnit.name,
            projects,
            attributeValues: orgUnit.attributeValues,
            openingDate: _.min(projects.map(project => project.openingDate)),
        };

        const d2Country = _.omit(orgUnit, ["children"]);
        return new CountryDashboard(config, d2Country, country);
    }

    generate() {
        const { d2Country, country } = this;

        const charts: Array<PartialPersistedModel<D2Chart>> = _.compact([
            this.aggregatedActualValuesPeopleChart(),
            this.aggregatedActualValuesBenefitChart(),
        ]);

        const reportTables: Array<PartialPersistedModel<D2ReportTable>> = _.compact([
            this.projectsActualPeopleTable(),
            this.projectsActualBenefitTable(),
        ]);

        const favorites = { reportTables, charts };

        const items: Array<PartialModel<D2DashboardItem>> = _.compact([
            ...charts.map(chart => getChartItem(chart)),
            ...reportTables.map(reportTable => getReportTableItem(reportTable)),
        ]);

        const dashboard: PartialPersistedModel<D2Dashboard> = {
            id: getUid("country-dashboard", country.id),
            name: country.name,
            dashboardItems: positionItems(items, positionItemsOptions),
            ...this.getSharing(),
        };

        const countryUpdated = addAttributeValueToObj(d2Country, {
            values: d2Country.attributeValues,
            attribute: this.config.attributes.projectDashboard,
            value: dashboard.id,
        });

        return {
            dashboards: [dashboard],
            organisationUnits: [countryUpdated],
            ...favorites,
        };
    }

    aggregatedActualValuesPeopleChart(): MaybeD2Chart {
        return this.getChart({
            key: "aggregated-actual-people",
            name: i18n.t("Aggregated Actual Values - People"),
            items: dataElementItems(this.dataElements.people),
            reportFilter: [dimensions.orgUnit, this.categories.new, this.categories.actual],
            seriesDimension: dimensions.data,
            categoryDimension: dimensions.period,
        });
    }

    aggregatedActualValuesBenefitChart(): MaybeD2Chart {
        return this.getChart({
            key: "aggregated-actual-benefit",
            name: i18n.t("Aggregated Actual Values - Benefit"),
            items: dataElementItems(this.dataElements.benefit),
            reportFilter: [dimensions.orgUnit, this.categories.actual],
            seriesDimension: dimensions.data,
            categoryDimension: dimensions.period,
        });
    }

    projectsActualPeopleTable(): MaybeD2Table {
        const { dataElements } = this;

        return this.getTable({
            key: "reportTable-actual-people",
            name: i18n.t("Projects - People"),
            items: dataElementItems(dataElements.people),
            reportFilter: [dimensions.period, this.categories.new, this.categories.actual],
            columnDimensions: [dimensions.data],
            rowDimensions: [dimensions.orgUnit],
        });
    }

    projectsActualBenefitTable(): MaybeD2Table {
        const { dataElements } = this;

        return this.getTable({
            key: "reportTable-actual-benefit",
            name: i18n.t("Projects - Benefit"),
            items: dataElementItems(dataElements.benefit),
            reportFilter: [dimensions.period, this.categories.actual],
            columnDimensions: [dimensions.data],
            rowDimensions: [dimensions.orgUnit],
        });
    }

    getChart(baseChart: BaseChart): MaybeD2Chart {
        const { country } = this;

        const chart: Chart = {
            ...baseChart,
            key: baseChart.key + country.id,
            name: `[${country.name}] ${baseChart.name}`,
            periods: [],
            relativePeriods: { thisYear: true },
            organisationUnits: [{ id: country.id }],
            sharing: this.getSharing(),
        };

        const d2Chart = getD2Chart(chart);

        return d2Chart ? { ...d2Chart, ...chart.extra } : null;
    }

    getTable(baseTable: BaseTable): MaybeD2Table {
        const { country } = this;

        const chart: Table = {
            ...baseTable,
            key: baseTable.key + country.id,
            name: `[${country.name}] ${baseTable.name}`,
            periods: [],
            relativePeriods: { thisYear: true },
            organisationUnits: country.projects.map(project => project.orgUnit),
            sharing: this.getSharing(),
        };

        const d2Table = getD2ReportTable(chart);

        return d2Table ? { ...d2Table, ...chart.extra } : null;
    }

    getSharing(): D2Sharing {
        return {
            publicAccess: getD2Access({ meta: { read: true, write: true } }),
        };
    }
}

const selectors = {
    organisationUnits: {
        $owner: true,
        children: { id: true, name: true },
        attributeValues: { attribute: { id: true }, value: true },
    },
    dataSets: {
        id: true,
        code: true,
        dataInputPeriods: { openingDate: true },
        dataSetElements: {
            dataElement: {
                id: true,
                name: true,
                code: true,
                dataElementGroups: { code: true },
            },
        },
    },
} as const;

type OrgUnitApi = SelectedPick<D2OrganisationUnitSchema, typeof selectors.organisationUnits>;
type DataSetApi = SelectedPick<D2DataSetSchema, typeof selectors.dataSets>;

interface Metadata {
    orgUnit: OrgUnitApi;
    dataSets: DataSetApi[];
}

async function getMetadata(api: D2Api, countryId: Id): Promise<Metadata | null> {
    const metadata$ = api.metadata.get({
        organisationUnits: {
            fields: selectors.organisationUnits,
            filter: { id: { eq: countryId } },
        },
        dataSets: {
            fields: selectors.dataSets,
            filter: { code: { like$: "_ACTUAL" } },
        },
    });

    const { organisationUnits, dataSets } = await metadata$.getData();
    const orgUnit = _(organisationUnits).get(0, null);

    return orgUnit ? { orgUnit, dataSets } : null;
}

function getProject(config: Config, metadata: Metadata, dataSet: DataSetApi): Project | null {
    const orgUnitById = _.keyBy(metadata.orgUnit.children, ou => ou.id);
    const projectId = dataSet.code.split("_")[0];
    const orgUnit = orgUnitById[projectId];
    if (!orgUnit) return null;

    const dateString = _(dataSet.dataInputPeriods)
        .map(dip => dip.openingDate)
        .min();
    if (!dateString) return null;

    const { people: peopleCode, benefit: benefitCode } = config.base.dataElementGroups;

    const dataElements = _(dataSet.dataSetElements)
        .map((dse): DataElement | null => {
            const { dataElement } = dse;
            const degCodes = dataElement.dataElementGroups.map((deg: any) => deg.code);
            const peopleOrBenefit = degCodes.includes(peopleCode)
                ? "people"
                : degCodes.includes(benefitCode)
                ? "benefit"
                : null;
            if (!peopleOrBenefit) return null;

            return {
                id: dataElement.id,
                name: dataElement.name,
                code: dataElement.code,
                peopleOrBenefit,
            };
        })
        .compact()
        .value();

    return {
        id: orgUnit.id,
        orgUnit: { id: orgUnit.id },
        openingDate: new Date(dateString),
        dataElements,
    };
}

const positionItemsOptions: PositionItemsOptions = {
    maxWidth: toItemWidth(100),
    defaultWidth: toItemWidth(100),
    defaultHeight: 30,
};

type BaseTable = Pick<
    Table,
    | "key"
    | "name"
    | "items"
    | "reportFilter"
    | "extra"
    | "rowDimensions"
    | "columnDimensions"
    | "rowTotals"
>;

type BaseChart = Pick<
    Chart,
    "key" | "name" | "items" | "reportFilter" | "categoryDimension" | "extra" | "seriesDimension"
>;

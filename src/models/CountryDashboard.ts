import _ from "lodash";
import { Config } from "./Config";
import {
    PartialPersistedModel,
    PartialModel,
    D2Api,
    SelectedPick,
    D2OrganisationUnitSchema,
    D2OrganisationUnit,
} from "../types/d2-api";
import { D2ReportTable, Ref, D2Chart, D2DashboardItem, Id } from "../types/d2-api";
import i18n from "../locales";
import { getUid, getRefs } from "../utils/dhis2";
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
import { addAttributeValueToObj, AttributeValue } from "./Attributes";
import {
    getProjectsListDashboard,
    ProjectsListDashboard,
    Condition,
    DashboardSourceMetadata,
} from "./ProjectsListDashboard";
import { D2Sharing, getD2Access } from "./Sharing";

interface DataElement {
    id: Id;
    name: string;
    code: string;
    peopleOrBenefit: PeopleOrBenefit;
}

interface Country {
    id: Id;
    name: string;
    attributeValues: Array<{ attribute: Ref; value: string }>;
    projectsListDashboard: ProjectsListDashboard;
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
        this.dataElements = country.projectsListDashboard.dataElements;

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
    }

    static async build(
        api: D2Api,
        config: Config,
        countryId: Id,
        initialMetadata?: DashboardSourceMetadata
    ): Promise<CountryDashboard> {
        const condition: Condition = { type: "country", id: countryId, initialMetadata };
        const projectsListDashboard = await getProjectsListDashboard(api, config, condition);
        const orgUnit = await getOrgUnit(api, countryId);
        if (!orgUnit) throw new Error("Cannot get orgunit");

        const country: Country = {
            id: orgUnit.id,
            name: orgUnit.name,
            projectsListDashboard,
            attributeValues: orgUnit.attributeValues,
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

        const dashboard = {
            id: getUid("country-dashboard", country.id),
            name: country.name,
            dashboardItems: positionItems(items, positionItemsOptions),
            ...this.getSharing(),
        };

        const countryUpdated = addAttributeValueToObj(d2Country, {
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
            organisationUnits: getRefs(country.projectsListDashboard.orgUnits),
            sharing: this.getSharing(),
        };

        const d2Table = getD2ReportTable(chart);

        return d2Table ? { ...d2Table, ...chart.extra } : null;
    }

    getSharing(): Partial<D2Sharing> {
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
};

type OrgUnitApi = SelectedPick<D2OrganisationUnitSchema, typeof selectors.organisationUnits>;

async function getOrgUnit(api: D2Api, countryId: Id): Promise<OrgUnitApi | null> {
    const metadata$ = api.metadata.get({
        organisationUnits: {
            fields: selectors.organisationUnits,
            filter: { id: { eq: countryId } },
        },
    });

    const { organisationUnits } = await metadata$.getData();
    return _(organisationUnits).get(0, null);
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

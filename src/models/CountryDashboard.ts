import { Config } from "./Config";
import {
    PartialPersistedModel,
    PartialModel,
    D2Api,
    SelectedPick,
    D2OrganisationUnitSchema,
    D2DataSetSchema,
} from "../types/d2-api";
import _ from "lodash";
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
    getCategoryDimensions,
    getDataDimensionItems,
    toItemWidth,
    PositionItemsOptions,
} from "./Dashboard";
import { PeopleOrBenefit } from "./dataElementsSet";
import { D2Sharing, getD2Access } from "./ProjectSharing";

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
    projects: Project[];
}

interface Project {
    id: Id;
    dataElements: DataElement[];
    openingDate: Date;
}

interface Category {
    id: Id;
    categoryOptions: Ref[];
}

export default class CountryDashboard {
    dataElements: Record<"all" | "people" | "benefit", DataElement[]>;
    categories: { new: Category; actual: Category };

    constructor(private config: Config, private country: Country) {
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
            openingDate: _.min(projects.map(project => project.openingDate)),
        };

        return new CountryDashboard(config, country);
    }

    generate() {
        const { country } = this;

        const reportTables: Array<PartialPersistedModel<D2ReportTable>> = _.compact([]);

        const charts: Array<PartialPersistedModel<D2Chart>> = _.compact([
            this.aggregatedActualValuesPeopleChart(),
        ]);

        const favorites = { reportTables, charts };

        const items: Array<PartialModel<D2DashboardItem>> = _.compact([
            ...reportTables.map(reportTable => getReportTableItem(reportTable)),
            ...charts.map(chart => getChartItem(chart)),
        ]);

        const positionItemsOptions: PositionItemsOptions = {
            maxWidth: toItemWidth(100),
            defaultWidth: toItemWidth(100),
            defaultHeight: 30,
        };

        const dashboard: PartialPersistedModel<D2Dashboard> = {
            id: getUid("country-dashboard", country.id),
            name: country.name,
            dashboardItems: positionItems(items, positionItemsOptions),
            ...this.getSharing(),
        };

        return { dashboards: [dashboard], ...favorites };
    }

    aggregatedActualValuesPeopleChart(): MaybeD2Chart {
        const { country, dataElements } = this;

        return this.getChart(country, dataElements.people, {
            key: "aggregated-actual-people",
            name: i18n.t("Aggregated Actual Values - People"),
            items: dataElements.people,
            reportFilter: [dimensions.orgUnit, this.categories.new, this.categories.actual],
            seriesDimension: dimensions.data,
            categoryDimension: dimensions.period,
        });
    }

    private getChart(country: Country, dataElements: DataElement[], chart: Chart): MaybeD2Chart {
        if (_.isEmpty(chart.items)) return null;
        const dimensions = [...chart.reportFilter, chart.seriesDimension, chart.categoryDimension];

        const baseChart: PartialPersistedModel<D2Chart> = {
            id: getUid(chart.key, country.id),
            name: `[${country.name}] ${chart.name}`,
            type: "COLUMN",
            aggregationType: "DEFAULT",
            showData: true,
            category: chart.categoryDimension.id,
            organisationUnits: [{ id: country.id }],
            dataDimensionItems: getDataDimensionItems(chart.items, this.config, dataElements),
            relativePeriods: { thisYear: true },
            series: chart.seriesDimension.id,
            columns: [chart.seriesDimension],
            rows: [chart.categoryDimension],
            filters: chart.reportFilter,
            filterDimensions: chart.reportFilter.map(dimension => dimension.id),
            categoryDimensions: getCategoryDimensions(dimensions),
            ...this.getSharing(),
        };

        return _.merge({}, baseChart, chart.extra || {});
    }

    getSharing(): D2Sharing {
        return {
            publicAccess: getD2Access({ meta: { read: true, write: true } }),
        };
    }
}

const selectors = {
    organisationUnits: {
        id: true,
        name: true,
        children: { id: true, name: true },
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

function getProject(config: Config, metadata: Metadata, dataSet: DataSetApi) {
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

    return { id: orgUnit.id, openingDate: new Date(dateString), dataElements };
}

import _ from "lodash";
import { Config } from "./Config";
import {
    PartialPersistedModel,
    PartialModel,
    D2Api,
    SelectedPick,
    D2OrganisationUnitSchema,
    D2OrganisationUnit,
    D2Visualization,
} from "../types/d2-api";
import { Ref, D2DashboardItem, Id } from "../types/d2-api";
import i18n from "../locales";
import { getUid, getRefs } from "../utils/dhis2";
import {
    getReportTableItem as getReportTableDashboardItem,
    getChartDashboardItem,
    positionItems,
    dimensions,
    toItemWidth,
    PositionItemsOptions,
    dataElementItems,
    Visualization,
    MaybeD2Visualization,
    getD2Visualization,
    VisualizationDefinition,
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

type D2VisualizationPayload = PartialPersistedModel<D2Visualization>;

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

        const reportTables: D2VisualizationPayload[] = _.compact([
            this.projectsActualPeopleTable(),
            this.projectsActualBenefitTable(),
        ]);

        const charts: D2VisualizationPayload[] = _.concat(
            this.aggregatedActualValuesPeopleChart(),
            this.aggregatedActualValuesBenefitChart()
        );

        const favorites = { visualizations: _.concat(reportTables, charts) };

        const items: Array<PartialModel<D2DashboardItem>> = _.compact([
            ...charts.map(chart => getChartDashboardItem(chart)),
            ...reportTables.map(reportTable => getReportTableDashboardItem(reportTable)),
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

    aggregatedActualValuesPeopleChart(): D2VisualizationPayload[] {
        return this.getCharts({
            key: "aggregated-actual-people",
            name: i18n.t("Aggregated Actual Values - People"),
            items: dataElementItems(this.dataElements.people),
            filters: [dimensions.orgUnit, this.categories.new, this.categories.actual],
            columns: [dimensions.data],
            rows: [dimensions.period],
        });
    }

    aggregatedActualValuesBenefitChart(): D2VisualizationPayload[] {
        return this.getCharts({
            key: "aggregated-actual-benefit",
            name: i18n.t("Aggregated Actual Values - Benefit"),
            items: dataElementItems(this.dataElements.benefit),
            filters: [dimensions.orgUnit, this.categories.actual],
            columns: [dimensions.data],
            rows: [dimensions.period],
        });
    }

    projectsActualPeopleTable(): MaybeD2Visualization {
        const { dataElements } = this;

        return this.getTable({
            key: "reportTable-actual-people",
            name: i18n.t("Projects - People"),
            items: dataElementItems(dataElements.people),
            filters: [dimensions.period, this.categories.new, this.categories.actual],
            columns: [dimensions.data],
            rows: [dimensions.orgUnit],
        });
    }

    projectsActualBenefitTable(): MaybeD2Visualization {
        const { dataElements } = this;

        return this.getTable({
            key: "reportTable-actual-benefit",
            name: i18n.t("Projects - Benefit"),
            items: dataElementItems(dataElements.benefit),
            filters: [dimensions.period, this.categories.actual],
            columns: [dimensions.data],
            rows: [dimensions.orgUnit],
        });
    }

    getCharts(definition: Omit<VisualizationDefinition, "type">): D2VisualizationPayload[] {
        const { country } = this;

        // DHIS 2.36 dhis-web-data-visualizer charts show a single stacked bar when the
        // x-axis contains 50 items or more. So let's chunk them in groups of 49 and add
        // a suffix to the name whenever necessary.
        const itemsGroupList = _.chunk(definition.items, 49);
        const total = itemsGroupList.length;
        const showCounting = total > 1;

        return _.compact(
            itemsGroupList.map((itemsGroup, idx) => {
                const nameSuf = showCounting
                    ? i18n.t("{{n}} of {{total}}", { n: idx + 1, total })
                    : "";

                const chart: Visualization = {
                    ...definition,
                    items: itemsGroup,
                    type: "chart",
                    key: definition.key + country.id + (idx === 0 ? "" : `-${idx + 1}`),
                    name: `[${country.name}] ${definition.name}` + (nameSuf ? ` (${nameSuf})` : ""),
                    periods: [],
                    relativePeriods: { thisYear: true },
                    organisationUnits: [{ id: country.id }],
                    sharing: this.getSharing(),
                };
                const d2Chart = getD2Visualization(chart);

                return d2Chart ? { ...d2Chart, ...chart.extra } : null;
            })
        );
    }

    getTable(definition: Omit<VisualizationDefinition, "type">): MaybeD2Visualization {
        const { country } = this;

        const chart: Visualization = {
            ...definition,
            type: "table",
            key: definition.key + country.id,
            name: `[${country.name}] ${definition.name}`,
            periods: [],
            relativePeriods: { thisYear: true },
            organisationUnits: getRefs(country.projectsListDashboard.orgUnits),
            sharing: this.getSharing(),
        };

        const d2Table = getD2Visualization(chart);

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

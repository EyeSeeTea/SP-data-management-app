import _ from "lodash";
import { TableSorting } from "@eyeseetea/d2-ui-components";
import { D2Api, D2OrganisationUnitSchema, SelectedPick, Id, Pager, Ref } from "../types/d2-api";
import { Config } from "./Config";
import moment, { Moment } from "moment";
import { Sector, getOrgUnitDatesFromProject, getProjectFromOrgUnit } from "./Project";
import { getSectorCodeFromSectionCode } from "./ProjectDb";
import User from "./user";
import { getIds } from "../utils/dhis2";
import { hasCurrentUserFullAccessToDataSet } from "./ProjectSharing";
import { Pagination, paginate } from "../utils/pagination";
import { Sharing, getSharing } from "./Sharing";
import { promiseMap } from "../migrations/utils";

export type FiltersForList = Partial<{
    search: string;
    createdByCurrentUser: boolean;
    countryIds: string[];
    sectorIds: string[];
    onlyActive: boolean;
    dateInProject: Moment;
    createdByAppOnly: boolean;
    userCountriesOnly: boolean;
}>;

const orgUnitFields = {
    id: true,
    user: { id: true, displayName: true },
    displayName: true,
    displayDescription: true,
    href: true,
    created: true,
    lastUpdated: true,
    lastUpdatedBy: { name: true },
    parent: { id: true, displayName: true },
    organisationUnitGroups: { id: true, groupSets: { id: true } },
    openingDate: true,
    closedDate: true,
    code: true,
    attributeValues: { value: true, attribute: { id: true } },
} as const;

type BaseProject = Omit<
    SelectedPick<D2OrganisationUnitSchema, typeof orgUnitFields>,
    "organisationUnitGroups"
>;

type D2OrgUnit = SelectedPick<D2OrganisationUnitSchema, typeof orgUnitFields>;

export interface ProjectForList extends BaseProject {
    sectors: Sector[];
    sharing: Sharing;
    hasAwardNumberDashboard: boolean;
    lastUpdatedData: string;
}

export interface Country {
    id: string;
    displayName: string;
}

export default class ProjectsList {
    currentUser: User;

    constructor(private api: D2Api, private config: Config) {
        this.currentUser = new User(config);
    }

    async get(
        filters: FiltersForList,
        sorting: TableSorting<ProjectForList>,
        pagination: Pagination
    ): Promise<{ objects: ProjectForList[]; countries: Country[]; pager: Pager }> {
        const { api, config } = this;
        const order = `${sorting.field}:i${sorting.order}`;
        const orgUnitIds = await this.getBaseOrgUnitIds(api, config, filters, order);

        const d2OrgUnitsUnsorted = _.flatten(
            await promiseMap(_.chunk(orgUnitIds, 300), async orgUnitIdsGroup => {
                const { objects } = await api.models.organisationUnits
                    .get({
                        paging: false,
                        fields: orgUnitFields,
                        filter: { id: { in: orgUnitIdsGroup } },
                        order,
                    })
                    .getData();
                return objects;
            })
        ).map((ou): typeof ou => ({ ...ou, displayName: ou.displayName?.trim() }));

        const d2OrgUnits = await this.sortOrgUnits(d2OrgUnitsUnsorted, sorting);

        const projects = d2OrgUnits.map(getProjectFromOrgUnit);
        const dataSetCodes = new Set(projects.map(ou => `${ou.id}_ACTUAL`));

        const res = _(dataSetCodes).isEmpty()
            ? { dataSets: [], organisationUnitGroupSets: [] }
            : await api.metadata
                  .get({
                      dataSets: {
                          fields: {
                              code: true,
                              sections: { code: true },
                              userAccesses: { id: true, displayName: true, access: true },
                              userGroupAccesses: { id: true, displayName: true, access: true },
                              access: true,
                              attributeValues: { attribute: { id: true }, value: true },
                          },
                          // When there are many projects, this results in a 414 error, filter on the response.
                          // filter: { code: { in: dataSetCodes } },
                          filter: { code: { like$: "_ACTUAL" } },
                      },
                      organisationUnitGroupSets: {
                          fields: {
                              id: true,
                              organisationUnitGroups: { id: true, organisationUnits: { id: true } },
                          },
                          // Same problem, 414, filter on the response
                          //filter: { id: { in: orgUnitGroupFilterIds } },
                          filter: { id: { eq: config.organisationUnitGroupSets.awardNumber.id } },
                      },
                  })
                  .getData();

        const dataSets = res.dataSets.filter(ds => dataSetCodes.has(ds.code));
        const orgUnitAwardNumberGroups =
            res.organisationUnitGroupSets[0]?.organisationUnitGroups || [];

        const dataSetByOrgUnitId = _.keyBy(dataSets, dataSet => (dataSet.code || "").split("_")[0]);
        const sectorsByCode = _.keyBy(config.sectors, sector => sector.code);
        const orgUnitsByAwardNumber = this.getOrgUnitsCountByAwardNumber(orgUnitAwardNumberGroups);

        const projectsWithSectors = projects.map(orgUnit => {
            const dataSet = _(dataSetByOrgUnitId).get(orgUnit.id, null);
            if (!dataSet || !hasCurrentUserFullAccessToDataSet(dataSet)) return null;

            const sharing = getSharing(dataSet);
            const sectors = _(dataSet.sections || [])
                .map(section => sectorsByCode[getSectorCodeFromSectionCode(section.code)])
                .compact()
                .value();

            const hasAwardNumberDashboard = (orgUnitsByAwardNumber[orgUnit.id] || 0) > 1;
            const lastUpdatedData =
                dataSet.attributeValues.find(
                    attributeValue =>
                        attributeValue.attribute.id === config.attributes.lastUpdatedData.id
                )?.value ?? "";

            const project: ProjectForList = {
                ..._.omit(orgUnit, ["organisationUnitGroups"]),
                sectors,
                sharing,
                hasAwardNumberDashboard,
                lastUpdatedData,
            };
            return project;
        });

        const { pager, objects } = paginate(_.compact(projectsWithSectors), pagination);

        const countries: Country[] = _(projects)
            .map(project => project.parent)
            .compact()
            .uniqBy(country => country.id)
            .sortBy(country => country.displayName)
            .value();

        return { pager, objects, countries: countries };
    }

    private async getDataSetsWithLastUpdatedData() {
        const { objects: dataSets } = await this.api.models.dataSets
            .get({
                paging: false,
                fields: { attributeValues: { attribute: { id: true }, value: true } },
                filter: {
                    "attributeValues.attribute.id": {
                        eq: this.config.attributes.lastUpdatedData.id,
                    },
                },
            })
            .getData();
        return dataSets;
    }

    private async sortOrgUnits(
        orgUnits: D2OrgUnit[],
        sorting: TableSorting<ProjectForList>
    ): Promise<D2OrgUnit[]> {
        switch (sorting.field) {
            case "lastUpdatedData": {
                const dataSets = await this.getDataSetsWithLastUpdatedData();
                const orgUnitsInfo = this.getOrgUnitsWithLastUpdatedData(dataSets, orgUnits);
                const [orgUnitsWithUpdate, orgUnitsWithoutUpdate] = _.partition(
                    orgUnitsInfo,
                    info => Boolean(info.lastUpdatedData)
                );

                return _(orgUnitsWithUpdate)
                    .orderBy([info => info.lastUpdatedData], [sorting.order])
                    .concat(orgUnitsWithoutUpdate)
                    .map(info => info.orgUnit)
                    .value();
            }
            default:
                return _(orgUnits).orderBy([sorting.field], [sorting.order]).value();
        }
    }

    private getOrgUnitsWithLastUpdatedData(
        dataSets: {
            attributeValues: Array<{ attribute: { id: string }; value: string }>;
        }[],
        orgUnits: D2OrgUnit[]
    ) {
        const lastUpdatedDataByOrgUnitId = _(dataSets)
            .map((dataSet): [Id, string] | null => {
                const orgUnitId = dataSet.attributeValues.find(
                    dv => dv.attribute.id === this.config.attributes.orgUnitProject.id
                )?.value;

                const lastUpdatedData = dataSet.attributeValues.find(
                    dv => dv.attribute.id === this.config.attributes.lastUpdatedData.id
                )?.value;

                return orgUnitId && lastUpdatedData ? [orgUnitId, lastUpdatedData] : null;
            })
            .compact()
            .fromPairs()
            .value();

        return orgUnits.map(orgUnit => ({
            orgUnit: orgUnit,
            lastUpdatedData: lastUpdatedDataByOrgUnitId[orgUnit.id],
        }));
    }

    private getOrgUnitsCountByAwardNumber(
        organisationUnitGroups: Array<{ id: string; organisationUnits: Ref[] }>
    ) {
        return _(organisationUnitGroups)
            .flatMap(oug => oug.organisationUnits.map(ou => ({ ouId: ou.id, oug: oug })))
            .keyBy(o => o.ouId)
            .mapValues(o => o.oug.organisationUnits.length)
            .value();
    }

    async getBaseOrgUnitIds(api: D2Api, config: Config, filters: FiltersForList, order: string) {
        const { currentUser } = this;
        const userId = currentUser.data.id;
        const createByAppAttrId = config.attributes.createdByApp.id;
        const createdByAppFilter = { "attributeValues.attribute.id": { eq: createByAppAttrId } };

        const { objects: d2OrgUnits } = await api.models.organisationUnits
            .get({
                paging: false,
                // Rename fields to make response as light as possible
                fields: {
                    id: { $fn: { name: "rename", to: "i" } as const },
                    code: { $fn: { name: "rename", to: "c" } as const },
                    displayName: { $fn: { name: "rename", to: "n" } as const },
                    attributeValues: { attribute: { id: true }, value: true },
                },
                order,
                filter: {
                    level: { eq: config.base.orgUnits.levelForProjects.toString() },
                    ...getDateFilter(filters),
                    ...getOrgUnitsFilter(filters, currentUser),
                    ...(filters.createdByAppOnly ? createdByAppFilter : {}),
                    ...(filters.createdByCurrentUser ? { "user.id": { eq: userId } } : {}),
                },
            })
            .getData();

        // Apply filters that are not possible in the api request:
        // (NAME or CODE) and SECTORS and CREATED_BY_APP

        const search = filters.search ? filters.search.toLowerCase() : undefined;
        const d2OrgUnitsFilteredByNameAndCode = search
            ? d2OrgUnits.filter(ou => {
                  const name = (ou.n || "").toLowerCase();
                  const code = (ou.c || "").toLowerCase();
                  // OR filter, not supported by the API
                  return name.includes(search) || code.includes(search);
              })
            : d2OrgUnits;

        const orgUnitsFilteredBySectors = await this.filterOrgUnitBySectors(
            d2OrgUnitsFilteredByNameAndCode,
            filters.sectorIds
        );

        const orgUnitsFiltered = !filters.createdByAppOnly
            ? orgUnitsFilteredBySectors
            : orgUnitsFilteredBySectors.filter(ou =>
                  _(ou.attributeValues).some(
                      attributeValue =>
                          attributeValue.attribute.id === config.attributes.createdByApp.id &&
                          attributeValue.value === "true"
                  )
              );

        return orgUnitsFiltered.map(ou => ou.i);
    }

    async filterOrgUnitBySectors<Ou extends { i: Id }>(
        orgUnits: Ou[],
        sectorIds: Id[] | undefined
    ) {
        if (!sectorIds || _.isEmpty(sectorIds) || _.isEmpty(orgUnits)) return orgUnits;

        const { api, config } = this;
        const sectorsById = _.keyBy(config.sectors, sector => sector.id);

        const sectorCodes = _(sectorsById)
            .at(sectorIds)
            .compact()
            .map(sector => sector.code)
            .value();

        const { objects: sections } = await api.models.sections
            .get({
                paging: false,
                fields: { dataSet: { code: true } },
                rootJunction: "OR",
                filter: { code: sectorCodes.map(code => ({ $like: code })) },
            })
            .getData();

        const orgUnitIdsWithinSections = new Set(
            _(sections)
                .map(section => (section.dataSet.code || "").split("_")[0] || "")
                .compact()
                .value()
        );

        return orgUnits.filter(ou => orgUnitIdsWithinSections.has(ou.i));
    }

    private getOrgUnitGroupsForAwardNumber(
        d2OrgUnits: Array<{
            organisationUnitGroups: Array<{ id: Id; groupSets: Ref[] }>;
        }>
    ) {
        const { config } = this;
        return _(d2OrgUnits)
            .flatMap(ou => ou.organisationUnitGroups)
            .filter(oug =>
                _(oug.groupSets).some(
                    groupSet => groupSet.id === config.organisationUnitGroupSets.awardNumber.id
                )
            )
            .value();
    }
}

function getDateFilter(filters: FiltersForList) {
    const now = moment();
    const dateFormat = "YYYY-MM-DD";
    const { onlyActive, dateInProject } = filters;

    // Merge dates for both filters (using the intersection of periods)

    const dates = _.compact([
        onlyActive ? getOrgUnitDatesFromProject(now, now) : null,
        dateInProject ? getOrgUnitDatesFromProject(dateInProject, dateInProject) : null,
    ]);

    const [openingDates, closedDates] = _(dates)
        .map(({ openingDate, closedDate }) => [moment(openingDate), moment(closedDate)])
        .unzip()
        .value();

    if (_(openingDates).isEmpty() || _(closedDates).isEmpty()) {
        return {};
    } else {
        return {
            openingDate: { le: moment.min(openingDates).format(dateFormat) },
            closedDate: { ge: moment.max(closedDates).format(dateFormat) },
        };
    }
}

function getOrgUnitsFilter(filters: FiltersForList, currentUser: User) {
    const userCountryIds = filters.userCountriesOnly ? getIds(currentUser.getCountries()) : null;
    const filterCountryIds = !_(filters.countryIds).isEmpty()
        ? _.intersection(..._.compact([userCountryIds, filters.countryIds]))
        : userCountryIds;
    return filterCountryIds ? { "parent.id": { in: filterCountryIds } } : {};
}

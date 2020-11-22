import _ from "lodash";
import { TableSorting } from "d2-ui-components";
import { D2Api, D2OrganisationUnitSchema, SelectedPick, Id, Pager } from "../types/d2-api";
import { Config } from "./Config";
import moment, { Moment } from "moment";
import { Sector, getOrgUnitDatesFromProject, getProjectFromOrgUnit } from "./Project";
import { getSectorCodeFromSectionCode } from "./ProjectDb";
import User from "./user";
import { getIds } from "../utils/dhis2";
import { Sharing, getSharing, hasCurrentUserFullAccessToDataSet } from "./ProjectSharing";

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

type Pagination = { page: number; pageSize: number };

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
    openingDate: true,
    closedDate: true,
    code: true,
} as const;

type BaseProject = SelectedPick<D2OrganisationUnitSchema, typeof orgUnitFields>;

export interface ProjectForList extends BaseProject {
    sectors: Sector[];
    sharing: Sharing;
    dataElementIdsBySectorId: Record<Id, Id[]>;
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
    ): Promise<{ objects: ProjectForList[]; pager: Pager }> {
        const { api, config } = this;
        const order = `${sorting.field}:i${sorting.order}`;
        const orgUnitIds = await this.getBaseOrgUnitIds(api, config, filters, order);

        const { objects: d2OrgUnits } =
            orgUnitIds.length === 0
                ? { objects: [] }
                : await api.models.organisationUnits
                      .get({
                          paging: false,
                          fields: orgUnitFields,
                          filter: { id: { in: orgUnitIds } },
                          order,
                      })
                      .getData();

        const projects = d2OrgUnits.map(getProjectFromOrgUnit);
        const dataSetCodes = _.sortBy(projects.map(ou => `${ou.id}_ACTUAL`));

        const { dataSets } = _(dataSetCodes).isEmpty()
            ? { dataSets: [] }
            : await api.metadata
                  .get({
                      dataSets: {
                          fields: {
                              code: true,
                              sections: { code: true, dataElements: { id: true } },
                              userAccesses: { id: true, displayName: true, access: true },
                              userGroupAccesses: { id: true, displayName: true, access: true },
                              access: true,
                          },
                          filter: { code: { in: dataSetCodes } },
                      },
                  })
                  .getData();

        const dataSetByOrgUnitId = _.keyBy(dataSets, dataSet => (dataSet.code || "").split("_")[0]);
        const sectorsByCode = _.keyBy(config.sectors, sector => sector.code);

        const projectsWithSectors = projects.map(orgUnit => {
            const dataSet = _(dataSetByOrgUnitId).get(orgUnit.id, null);
            if (!dataSet || !hasCurrentUserFullAccessToDataSet(dataSet)) return null;

            const sharing = getSharing(dataSet);
            const sectors = _(dataSet.sections || [])
                .map(section => sectorsByCode[getSectorCodeFromSectionCode(section.code)])
                .compact()
                .value();

            const dataElementIdsBySectorId = _(dataSet.sections || [])
                .map(section => ({
                    sector: sectorsByCode[getSectorCodeFromSectionCode(section.code)],
                    section,
                }))
                .filter(({ sector }) => !!sector)
                .map(({ sector, section }) => [sector.id, section.dataElements.map(de => de.id)])
                .fromPairs()
                .value();

            const project: ProjectForList = {
                ...orgUnit,
                sectors,
                sharing,
                dataElementIdsBySectorId,
            };
            return project;
        });

        return paginate(_.compact(projectsWithSectors), pagination);
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
}

function paginate<Obj>(objects: Obj[], pagination: Pagination) {
    const pager = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        pageCount: Math.ceil(objects.length / pagination.pageSize),
        total: objects.length,
    };
    const { page, pageSize } = pagination;
    const start = (page - 1) * pageSize;

    const paginatedObjects = _(objects)
        .slice(start, start + pageSize)
        .sortBy()
        .value();

    return { pager, objects: paginatedObjects };
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

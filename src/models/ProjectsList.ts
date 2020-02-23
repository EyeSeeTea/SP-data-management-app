import _ from "lodash";
import { TableSorting, TablePagination } from "d2-ui-components";
import { D2Api, D2OrganisationUnitSchema, SelectedPick, Id } from "d2-api";
import { Config } from "./Config";
import moment from "moment";
import { Sector, getOrgUnitDatesFromProject, getProjectFromOrgUnit } from "./Project";
import { getSectorCodeFromSectionCode } from "./ProjectDb";
import User from "./user";
import { getIds } from "../utils/dhis2";

export type FiltersForList = Partial<{
    search: string;
    createdByCurrentUser: boolean;
    countryIds: string[];
    sectorIds: string[];
    onlyActive: boolean;
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
    publicAccess: true,
    created: true,
    lastUpdated: true,
    lastUpdatedBy: { name: true },
    parent: { id: true, displayName: true },
    openingDate: true,
    closedDate: true,
    code: true,
} as const;

export type ProjectForList = SelectedPick<D2OrganisationUnitSchema, typeof orgUnitFields> & {
    sectors: Sector[];
};

export default class ProjectsList {
    currentUser: User;

    constructor(private api: D2Api, private config: Config) {
        this.currentUser = new User(config);
    }

    async get(
        filters: FiltersForList,
        sorting: TableSorting<ProjectForList>,
        pagination: Pagination
    ): Promise<{ objects: ProjectForList[]; pager: Partial<TablePagination> }> {
        const { api, config } = this;
        const order = `${sorting.field}:i${sorting.order}`;
        const baseOrgUnitIds = await this.getBaseOrgUnitIds(api, config, filters, order);
        const { pager, objects: orgUnitIds } = paginate(baseOrgUnitIds, pagination);

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
                          fields: { code: true, sections: { code: true } },
                          filter: { code: { in: dataSetCodes } },
                      },
                  })
                  .getData();

        const dataSetByOrgUnitId = _.keyBy(dataSets, dataSet => (dataSet.code || "").split("_")[0]);
        const sectorsByCode = _.keyBy(config.sectors, sector => sector.code);

        const projectsWithSectors = projects.map(orgUnit => {
            const dataSet = _(dataSetByOrgUnitId).get(orgUnit.id, null);
            if (!dataSet) {
                return { ...orgUnit, sectors: [] };
            } else {
                const sectors = _(dataSet.sections || [])
                    .map(section => sectorsByCode[getSectorCodeFromSectionCode(section.code)])
                    .compact()
                    .value();
                return { ...orgUnit, sectors };
            }
        });

        return { pager: pager, objects: projectsWithSectors };
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
    const { openingDate, closedDate } = getOrgUnitDatesFromProject(now, now);

    if (filters.onlyActive) {
        return {
            openingDate: { le: moment(openingDate).format(dateFormat) },
            closedDate: { ge: moment(closedDate).format(dateFormat) },
        };
    } else {
        return {};
    }
}

function getOrgUnitsFilter(filters: FiltersForList, currentUser: User) {
    const userCountryIds = filters.userCountriesOnly ? getIds(currentUser.getCountries()) : null;
    const filterCountryIds = !_(filters.countryIds).isEmpty()
        ? _.intersection(..._.compact([userCountryIds, filters.countryIds]))
        : userCountryIds;
    return filterCountryIds ? { "parent.id": { in: filterCountryIds } } : {};
}

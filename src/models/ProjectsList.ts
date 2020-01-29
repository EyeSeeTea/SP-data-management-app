import _ from "lodash";
import { TableSorting, TablePagination } from "d2-ui-components";
import { D2Api, D2OrganisationUnitSchema, SelectedPick, Id } from "d2-api";
import { Config } from "./Config";
import moment from "moment";
import { Sector, getOrgUnitDatesFromProject, getProjectFromOrgUnit } from "./Project";
import { getSectorCodeFromSectionCode } from "./ProjectDb";

export type FiltersForList = Partial<{
    search: string;
    createdByCurrentUser: boolean;
    countryIds: string[];
    sectorIds: string[];
    onlyActive: boolean;
}>;

const yes = true as const;

const orgUnitFields = {
    id: yes,
    user: { id: yes, displayName: yes },
    displayName: yes,
    displayDescription: yes,
    href: yes,
    publicAccess: yes,
    created: yes,
    lastUpdated: yes,
    lastUpdatedBy: { name: yes },
    parent: { id: yes, displayName: yes },
    openingDate: yes,
    closedDate: yes,
    code: yes,
};

export type ProjectForList = SelectedPick<D2OrganisationUnitSchema, typeof orgUnitFields> & {
    sectors: Sector[];
};

export default class ProjectsList {
    constructor(private api: D2Api, private config: Config) {}

    async get(
        filters: FiltersForList,
        sorting: TableSorting<ProjectForList>,
        pagination: { page: number; pageSize: number }
    ): Promise<{ objects: ProjectForList[]; pager: Partial<TablePagination> }> {
        const { api, config } = this;
        const data = await this.getOrgUnitListData(api, config, filters, sorting, pagination);
        const { order, pager, ids } = data;

        const { objects: d2OrgUnits } =
            ids.length === 0
                ? { objects: [] }
                : await api.models.organisationUnits
                      .get({
                          paging: false,
                          fields: orgUnitFields,
                          filter: { id: { in: ids } },
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

        const dataSetByOrgUnitId = _.keyBy(dataSets, dataSet => dataSet.code.split("_")[0]);
        const sectorsByCode = _.keyBy(config.sectors, sector => sector.code);

        const projectsWithSectors = projects.map(orgUnit => {
            const dataSet = _(dataSetByOrgUnitId).get(orgUnit.id, null);
            if (!dataSet) {
                return { ...orgUnit, sectors: [] };
            } else {
                const sectors = dataSet.sections.map(
                    section => sectorsByCode[getSectorCodeFromSectionCode(section.code)]
                );
                return { ...orgUnit, sectors };
            }
        });

        return { pager: pager, objects: projectsWithSectors };
    }

    async getOrgUnitListData(
        api: D2Api,
        config: Config,
        filters: FiltersForList,
        sorting: TableSorting<ProjectForList>,
        pagination: { page: number; pageSize: number }
    ) {
        const order = `${sorting.field}:i${sorting.order}`;
        const userId = config.currentUser.id;
        const filterCountryIds = _.isEmpty(filters.countryIds) ? undefined : filters.countryIds;
        const now = moment();
        const { openingDate, closedDate } = getOrgUnitDatesFromProject(now, now);

        const dateFilter = filters.onlyActive
            ? {
                  openingDate: { le: moment(openingDate).format("YYYY-MM-DD") },
                  closedDate: { ge: moment(closedDate).format("YYYY-MM-DD") },
              }
            : {};

        const { objects: d2OrgUnits } = await api.models.organisationUnits
            .get({
                paging: false,
                // Rename fields to make response as light as possible
                fields: {
                    id: { $fn: { name: "rename", to: "i" } as const },
                    code: { $fn: { name: "rename", to: "c" } as const },
                    displayName: { $fn: { name: "rename", to: "n" } as const },
                },
                order,
                filter: {
                    level: { eq: "3" },
                    ...dateFilter,
                    ...(filters.createdByCurrentUser ? { "user.id": { eq: userId } } : {}),
                    ...(filterCountryIds ? { "parent.id": { in: filterCountryIds } } : {}),
                },
            })
            .getData();

        // Apply filters that are not possible in the api request: (NAME or CODE) and SECTORS
        const search = filters.search ? filters.search.toLowerCase() : undefined;

        const d2OrgUnitsFilteredByNameAndCode = search
            ? d2OrgUnits.filter(ou => {
                  const name = ou.n.toLowerCase();
                  const code = ou.c.toLowerCase();
                  // OR filter, not supported by the API
                  return name.includes(search) || code.includes(search);
              })
            : d2OrgUnits;

        const d2OrgUnitsFiltered = await this.filterOrgUnitBySectors(
            d2OrgUnitsFilteredByNameAndCode,
            filters.sectorIds
        );

        // Paginator

        const pager = {
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: d2OrgUnitsFiltered.length,
        };
        const { page, pageSize } = pagination;
        const start = (page - 1) * pageSize;

        const ids = _(d2OrgUnitsFiltered)
            .slice(start, start + pageSize)
            .map(ou => ou.i)
            .sortBy()
            .value();

        return { order, pager, ids };
    }

    async filterOrgUnitBySectors(orgUnits: Array<{ i: Id }>, sectorIds: Id[] | undefined) {
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
                .map(section => section.dataSet.code.split("_")[0] || "")
                .compact()
                .value()
        );

        return orgUnits.filter(ou => orgUnitIdsWithinSections.has(ou.i));
    }
}

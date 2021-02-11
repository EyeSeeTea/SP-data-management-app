import _ from "lodash";
import { TableSorting } from "d2-ui-components";
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
} as const;

type BaseProject = Omit<
    SelectedPick<D2OrganisationUnitSchema, typeof orgUnitFields>,
    "organisationUnitGroups"
>;

export interface ProjectForList extends BaseProject {
    sectors: Sector[];
    sharing: Sharing;
    dataElementIdsBySectorId: Record<Id, Id[]>;
    hasAwardNumberDashboard: boolean;
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
        const dataSetCodes = new Set(_.sortBy(projects.map(ou => `${ou.id}_ACTUAL`)));
        const orgUnitGroupIds = new Set(getIds(this.getOrgUnitGroupsForAwardNumber(d2OrgUnits)));

        const res = _(dataSetCodes).isEmpty()
            ? { dataSets: [], organisationUnitGroups: [] }
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
                          // When there are many projects, this results in a 414 error, filter on the response.
                          // filter: { code: { in: dataSetCodes } },
                          filter: { code: { like$: "_ACTUAL" } },
                      },
                      organisationUnitGroups: {
                          fields: {
                              id: true,
                              organisationUnits: true,
                          },
                          // Same problem, 414, filter on the response
                          //filter: { id: { in: orgUnitGroupFilterIds } },
                      },
                  })
                  .getData();

        const dataSets = res.dataSets.filter(ds => dataSetCodes.has(ds.code));
        const organisationUnitGroups = res.organisationUnitGroups.filter(oug =>
            orgUnitGroupIds.has(oug.id)
        );

        const dataSetByOrgUnitId = _.keyBy(dataSets, dataSet => (dataSet.code || "").split("_")[0]);
        const sectorsByCode = _.keyBy(config.sectors, sector => sector.code);
        const orgUnitsByAwardNumber = this.getOrgUnitsCountByAwardNumber(organisationUnitGroups);

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

            const hasAwardNumberDashboard = (orgUnitsByAwardNumber[orgUnit.id] || 0) > 1;

            const project: ProjectForList = {
                ..._.omit(orgUnit, ["organisationUnitGroups"]),
                sectors,
                sharing,
                dataElementIdsBySectorId,
                hasAwardNumberDashboard,
            };
            return project;
        });

        return paginate(_.compact(projectsWithSectors), pagination);
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

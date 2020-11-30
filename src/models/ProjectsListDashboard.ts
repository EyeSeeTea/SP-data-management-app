import _ from "lodash";
import moment from "moment";
import { Id, Ref, D2Api, SelectedPick, D2DataSetSchema } from "../types/d2-api";
import { PeopleOrBenefit } from "./dataElementsSet";
import { Config } from "./Config";
import { Maybe } from "../types/utils";
import { getPeriodsFromRange, monthPeriod } from "./Period";
import {
    Sharing,
    emptySharing,
    getSharing,
    D2Sharing,
    mergeSharing as unionSharing,
} from "./Sharing";

interface DashboardProject {
    id: Id;
    orgUnit: Ref;
    dataElements: DataElement[];
    openingDate: Date;
    closingDate: Date;
    sharing: Sharing;
}

export interface DataElement {
    id: Id;
    name: string;
    code: string;
    peopleOrBenefit: PeopleOrBenefit;
    hasPairedDataElements: boolean;
}

export interface ProjectsListDashboard {
    id: Id;
    name: string;
    orgUnits: Ref[];
    parentOrgUnit: Maybe<Ref>;
    sharing: Sharing;
    dates: Maybe<{ opening: Date; closing: Date }>;
    periods: string[];
    dataElements: Record<"all" | "people" | "benefit", DataElement[]>;
}

const query = {
    organisationUnits: {
        id: true,
        name: true,
        path: true,
        parent: true,
        children: { id: true, name: true, parent: true },
    },
    dataSets: {
        id: true,
        code: true,
        dataInputPeriods: { period: { id: true } },
        publicAccess: true,
        externalAccess: true,
        userAccesses: { id: true, access: true, displayName: true },
        userGroupAccesses: { id: true, access: true, displayName: true },
        dataSetElements: {
            dataElement: {
                id: true,
                name: true,
                code: true,
                dataElementGroups: { code: true },
                attributeValues: { attribute: { id: true }, value: true },
            },
        },
    },
} as const;

export async function getProjectsListDashboard(
    api: D2Api,
    config: Config,
    condition: Condition
): Promise<ProjectsListDashboard> {
    const metadata = await getMetadata(api, condition);

    const projects: DashboardProject[] = _(metadata.dataSets)
        .map(dataSet => getProject(config, metadata, dataSet))
        .compact()
        .value();

    const dataElements = _(projects)
        .flatMap(project => project.dataElements)
        .uniqBy(dataElement => dataElement.id)
        .sortBy(dataElement => dataElement.name)
        .value();

    const dataElementsByType = {
        all: dataElements,
        people: dataElements.filter(de => de.peopleOrBenefit === "people"),
        benefit: dataElements.filter(de => de.peopleOrBenefit === "benefit"),
    };

    const openingDate = _.min(projects.map(project => project.openingDate));
    const closingDate = _.max(projects.map(project => project.closingDate));
    const sharing = projects.map(project => project.sharing).reduce(unionSharing, emptySharing);
    const parentOrgUnit =
        condition.type === "country"
            ? { id: condition.id }
            : _.first(metadata.orgUnits.map(ou => ou.parent));

    const dashboardProjects: ProjectsListDashboard = {
        id: condition.type === "country" || condition.type === "project" ? condition.id : "",
        parentOrgUnit,
        sharing,
        name: getName(metadata, condition),
        orgUnits: metadata.orgUnits,
        periods: getPeriodsFromRange(openingDate, closingDate),
        dates: openingDate && closingDate ? { opening: openingDate, closing: closingDate } : null,
        dataElements: dataElementsByType,
    };

    return dashboardProjects;
}

function getName(metadata: Metadata, condition: Condition): string {
    switch (condition.type) {
        case "country":
        case "project": {
            const country = metadata.orgUnits.find(ou => ou.id === condition.id);
            return country ? country.name : "-";
        }
        case "awardNumber":
            return _(metadata.orgUnits)
                .map(ou => ou.name)
                .sort()
                .join(", ");
    }
}

type OrgUnitApi = { id: Id; name: string; parent: Ref } & D2Sharing;
type DataSetApi = SelectedPick<D2DataSetSchema, typeof query.dataSets>;

interface Metadata {
    orgUnits: OrgUnitApi[];
    dataSets: DataSetApi[];
}

type Condition =
    | { type: "project"; id: Id }
    | { type: "country"; id: Id }
    | { type: "awardNumber"; value: string };

async function getMetadata(api: D2Api, condition: Condition): Promise<Metadata> {
    const metadata$ = api.metadata.get({
        organisationUnits: {
            fields: query.organisationUnits,
            filter:
                condition.type === "country" || condition.type === "project"
                    ? { id: { eq: condition.id } }
                    : { code: { $like: condition.value } },
        },
        dataSets: {
            fields: query.dataSets,
            filter: {
                code: { like$: "_ACTUAL" },
                ...(condition.type === "country" || condition.type === "project"
                    ? { "organisationUnits.path": { like: condition.id } }
                    : { "organisationUnits.code": { $like: condition.value } }),
            },
        },
    });

    const { organisationUnits, dataSets } = await metadata$.getData();

    const orgUnits =
        condition.type === "country"
            ? _.flatMap(organisationUnits, ou => ou.children)
            : organisationUnits.map(ou => _.pick(ou, ["id", "name", "parent"]));

    return { orgUnits, dataSets };
}

function getProject(
    config: Config,
    metadata: Metadata,
    dataSet: DataSetApi
): DashboardProject | null {
    const orgUnitById = _.keyBy(metadata.orgUnits, ou => ou.id);
    const projectId = dataSet.code.split("_")[0];
    const orgUnit = orgUnitById[projectId];
    if (!orgUnit) return null;

    const periodIds = dataSet.dataInputPeriods.map(dip => dip.period.id as string);
    const openingPeriod = _.min(periodIds);
    const closingPeriod = _.max(periodIds);
    if (!openingPeriod || !closingPeriod) return null;

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

            const hasPairedDataElements = _(dataElement.attributeValues).some(
                de =>
                    de.attribute.id === config.attributes.pairedDataElement.id &&
                    !_.isEmpty(de.value)
            );

            return {
                id: dataElement.id,
                name: dataElement.name,
                code: dataElement.code,
                peopleOrBenefit,
                hasPairedDataElements,
            };
        })
        .compact()
        .value();

    return {
        id: orgUnit.id,
        orgUnit: { id: orgUnit.id },
        openingDate: moment(openingPeriod, monthPeriod).toDate(),
        closingDate: moment(closingPeriod, monthPeriod).toDate(),
        dataElements,
        sharing: getSharing(dataSet),
    };
}

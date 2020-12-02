import _ from "lodash";
import moment from "moment";
import { Id, Ref, D2Api, SelectedPick } from "../types/d2-api";
import { D2DataSetSchema, D2OrganisationUnitSchema } from "../types/d2-api";
import { PeopleOrBenefit } from "./dataElementsSet";
import { Config } from "./Config";
import { Maybe } from "../types/utils";
import { getPeriodsFromRange, monthPeriod } from "./Period";
import { Sharing, emptySharing, getSharing, mergeSharing as unionSharing } from "./Sharing";
import i18n from "../locales";
import { getUid } from "../utils/dhis2";

type OrgUnitApi = Omit<
    SelectedPick<D2OrganisationUnitSchema, typeof query.organisationUnits>,
    "children"
>;
type DataSetApi = SelectedPick<D2DataSetSchema, typeof query.dataSets>;

export interface DashboardSourceMetadata {
    orgUnits: OrgUnitApi[];
    dataSets: DataSetApi[];
}

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
        parent: true,
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

export type Condition =
    | { type: "project"; id: Id; initialMetadata: DashboardSourceMetadata | undefined }
    | { type: "country"; id: Id; initialMetadata: DashboardSourceMetadata | undefined }
    | { type: "awardNumber"; value: string; initialMetadata: DashboardSourceMetadata | undefined };

export type DashboardType = Condition["type"];

export async function getProjectsListDashboard(
    api: D2Api,
    config: Config,
    condition: Condition
): Promise<ProjectsListDashboard> {
    const { initialMetadata } = condition;
    const existingMetadata = await getMetadata(api, condition);
    const metadata = mergeMetadata(initialMetadata, existingMetadata);

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
        ...getIdName(metadata, condition),
        parentOrgUnit,
        sharing,
        orgUnits: metadata.orgUnits,
        periods: getPeriodsFromRange(openingDate, closingDate),
        dates: openingDate && closingDate ? { opening: openingDate, closing: closingDate } : null,
        dataElements: dataElementsByType,
    };

    return dashboardProjects;
}

function getIdName(
    metadata: DashboardSourceMetadata,
    condition: Condition
): { id: Id; name: string } {
    switch (condition.type) {
        case "country":
        case "project": {
            const orgUnit = metadata.orgUnits.find(ou => ou.id === condition.id);
            return { id: condition.id, name: orgUnit ? orgUnit.name : "-" };
        }
        case "awardNumber": {
            const name = i18n.t("Award Number {{awardNumber}}", { awardNumber: condition.value });
            return { id: getUid("awardNumbers", condition.value), name };
        }
    }
}

function mergeMetadata(
    metadata1: DashboardSourceMetadata | undefined,
    metadata2: DashboardSourceMetadata
): DashboardSourceMetadata {
    const { orgUnits: orgUnits1 = [], dataSets: dataSets1 = [] } = metadata1 || {};
    const { orgUnits: orgUnits2, dataSets: dataSets2 } = metadata2;
    return { orgUnits: orgUnits1.concat(orgUnits2), dataSets: dataSets1.concat(dataSets2) };
}

async function getMetadata(api: D2Api, condition: Condition): Promise<DashboardSourceMetadata> {
    const metadata$ = api.metadata.get({
        organisationUnits: {
            fields: { ...query.organisationUnits, children: query.organisationUnits },
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
    metadata: DashboardSourceMetadata,
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

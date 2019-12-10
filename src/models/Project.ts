import { Config } from "./Config";
import moment, { Moment } from "moment";

/*
Project model.

* Get an existing project:

    const existingProject = await Project.get(d2Api, "gr7Fzf5l9F2");

* Create a new project, set fields and validate:

    const project = Project.create(d2Api);
    const projectWithNameAndDescription = project
        .set("name", "Project Name")
        .set("description", "Some description")

    projectWithNameAndDescription.name
    # "Project Name"

    # Also:

    const projectWithNameAndDescription = project.setObj({
        name: "Project Name",
        description: "Some description",
    });

    const errors = await projectWithNameAndDescription.validate(["name", "description"])
    # {name: [], description: []}

    const errors = await projectWithNameAndDescription.validate()
    # {
        "name": [],
        "startDate": [
            "Start Date cannot be blank"
        ],
        ...
      }


* Get paginated list of projects:

    const { objects, pager } = await Project.getList(
        api,
        config,
        { search: "abc", createdByCurrentUser: true },
        { page: 2, pageSize: 10, sorting: ["displayName", "desc"] }
    )
*/

import _ from "lodash";
import { D2Api, SelectedPick, Id, D2OrganisationUnitSchema, Ref } from "d2-api";
import { Pagination } from "./../types/ObjectsList";
import { Pager } from "d2-api/api/models";
import i18n from "../locales";
import DataElementsSet, { SelectionUpdate } from "./dataElementsSet";
import ProjectDb from "./ProjectDb";
import { Maybe } from "../types/utils";
import { toISOString } from "../utils/date";

export interface ProjectData {
    name: string;
    description: string;
    awardNumber: string;
    subsequentLettering: string;
    speedKey: string;
    startDate?: Moment;
    endDate?: Moment;
    sectors: Sector[];
    funders: Funder[];
    locations: Location[];
    organisationUnit: OrganisationUnit | undefined;
    dataElements: DataElementsSet;
}

interface NamedObject {
    id: Id;
    displayName: string;
}

export type Sector = NamedObject;
export type Funder = NamedObject;
export type Location = NamedObject;

export interface Relations {
    name: string;
    organisationUnit: NamedObject;
    dashboard: Maybe<Ref>;
    dataSets: { actual: Maybe<DataSetWithPeriods>; target: Maybe<DataSetWithPeriods> };
}

interface DataInputPeriod {
    period: { id: string };
    openingDate: string;
    closingDate: string;
}

export interface DataSetWithPeriods {
    id: string;
    code: string;
    dataInputPeriods: DataInputPeriod[];
}

// TODO: Add also displayName
interface OrganisationUnit {
    path: string;
}

const monthFormat = "YYYYMM";

const defaultProjectData = {
    name: "",
    description: "",
    awardNumber: "",
    subsequentLettering: "",
    speedKey: "",
    startDate: undefined,
    endDate: undefined,
    sectors: [],
    funders: [],
    locations: [],
    organisationUnit: undefined,
};

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
    openingDate: yes,
    closedDate: yes,
    code: yes,
};

export type ProjectForList = SelectedPick<D2OrganisationUnitSchema, typeof orgUnitFields>;

export type FiltersForList = Partial<{
    search: string;
    createdByCurrentUser: boolean;
}>;

function defineGetters(sourceObject: any, targetObject: any) {
    Object.keys(sourceObject).forEach(function(key) {
        Object.defineProperty(targetObject, key, {
            get: () => sourceObject[key],
            enumerable: true,
            configurable: true,
        });
    });
}

export type ProjectField = keyof ProjectData;
export type ValidationKey = keyof ProjectData | "code";
type Validation = () => ValidationError | Promise<ValidationError>;
type ValidationError = string[];
type Validations = { [K in ValidationKey]?: Validation };

class Project {
    static lengths = {
        awardNumber: 5,
        subsequentLettering: 2,
        speedKey: 40,
    };

    static fieldNames: Record<ProjectField, string> = {
        name: i18n.t("Name"),
        dataElements: i18n.t("Data Elements"),
        description: i18n.t("Description"),
        awardNumber: i18n.t("Award Number"),
        subsequentLettering: i18n.t("Subsequent Lettering"),
        speedKey: i18n.t("Speed Key"),
        startDate: i18n.t("Start Date"),
        endDate: i18n.t("End Date"),
        sectors: i18n.t("Sectors"),
        funders: i18n.t("Funders"),
        locations: i18n.t("Project Locations"),
        organisationUnit: i18n.t("Organisation Unit"),
    };

    static getFieldName(field: ProjectField): string {
        return this.fieldNames[field];
    }

    f(field: ProjectField): string {
        return Project.getFieldName(field);
    }

    validations: Validations = {
        name: () => validatePresence(this.name, this.f("name")),
        startDate: () => validatePresence(this.startDate, this.f("startDate")),
        endDate: () => validatePresence(this.endDate, this.f("endDate")),
        code: () => this.validateCodeUniqueness(),
        awardNumber: () =>
            validateRegexp(
                this.awardNumber,
                this.f("awardNumber"),
                new RegExp(`^\\d{${Project.lengths.awardNumber}}$`),
                i18n.t("Award Number should be a number of 5 digits")
            ),
        subsequentLettering: () =>
            validateLength(this.subsequentLettering, this.f("subsequentLettering"), {
                length: Project.lengths.subsequentLettering,
            }),
        speedKey: () =>
            validateNumber(this.speedKey.length, this.f("speedKey"), {
                max: Project.lengths.speedKey,
            }),
        sectors: () => validateNonEmpty(this.sectors, this.f("sectors")),
        funders: () => validateNonEmpty(this.funders, this.f("funders")),
        locations: () => validateNonEmpty(this.locations, this.f("locations")),
        organisationUnit: () =>
            this.organisationUnit ? [] : [i18n.t("One Organisation Unit should be selected")],
        dataElements: () => this.dataElements.validate(this.sectors),
    };

    static requiredFields: Set<ProjectField> = new Set([
        "name",
        "startDate",
        "endDate",
        "awardNumber",
        "subsequentLettering",
        "sectors",
        "funders",
        "locations",
        "organisationUnit",
        "dataElements",
    ]);

    constructor(public api: D2Api, public config: Config, private data: ProjectData) {
        defineGetters(data, this);
    }

    static isFieldRequired(field: ProjectField) {
        return Project.requiredFields.has(field);
    }

    public set<K extends keyof ProjectData>(field: K, value: ProjectData[K]): Project {
        return new Project(this.api, this.config, { ...this.data, [field]: value });
    }

    public setObj<K extends keyof ProjectData>(obj: Pick<ProjectData, K>): Project {
        return new Project(this.api, this.config, { ...this.data, ...obj });
    }

    public get shortName(): string {
        return this.data.name.slice(0, 50);
    }

    public get code(): string {
        return _([
            this.subsequentLettering,
            this.awardNumber,
            this.speedKey ? "-" + this.speedKey : null,
        ])
            .compact()
            .join("");
    }

    public async validate(
        validationKeys: (ValidationKey)[] | undefined = undefined
    ): Promise<Validations> {
        const obj = _(validationKeys || (_.keys(this.validations) as ValidationKey[]))
            .map(key => [key, this.validations[key]])
            .fromPairs()
            .mapValues(validationFn => (validationFn ? validationFn.call(this) : []))
            .value();
        const [keys, promises] = _.unzip(_.toPairs(obj));
        const values = await Promise.all(promises);
        return _.fromPairs(_.zip(keys, values)) as Validations;
    }

    static async getRelations(
        api: D2Api,
        config: Config,
        projectId: string
    ): Promise<Relations | undefined> {
        const { organisationUnits, dataSets } = await api.metadata
            .get({
                organisationUnits: {
                    fields: {
                        id: true,
                        displayName: true,
                        attributeValues: { attribute: { id: true }, value: true },
                    },
                    filter: { id: { eq: projectId } },
                },
                dataSets: {
                    fields: {
                        id: true,
                        code: true,
                        dataInputPeriods: { period: true, openingDate: true, closingDate: true },
                    },
                    filter: { code: { $like: projectId } },
                },
            })
            .getData();
        const orgUnit = organisationUnits[0];
        if (!orgUnit) return;

        const { projectDashboard } = config.attributes;
        const dashboardId = _(orgUnit.attributeValues)
            .map(av => (av.attribute.id === projectDashboard.id ? av.value : null))
            .compact()
            .first();

        const getDataSet = (type: "actual" | "target") =>
            dataSets.find(ds => ds.code.endsWith(type.toUpperCase()));

        return {
            name: orgUnit.displayName,
            organisationUnit: orgUnit,
            dashboard: dashboardId ? { id: dashboardId } : undefined,
            dataSets: { actual: getDataSet("actual"), target: getDataSet("target") },
        };
    }

    static async getData(
        config: Config,
        partialData: Omit<ProjectData, "dataElements">
    ): Promise<ProjectData> {
        const dataElements = await DataElementsSet.build(config);
        return { ...partialData, dataElements };
    }

    static async get(api: D2Api, config: Config, _id: string) {
        return new Project(api, config, await Project.getData(config, defaultProjectData));
    }

    static async create(api: D2Api, config: Config) {
        return new Project(api, config, await Project.getData(config, defaultProjectData));
    }

    save() {
        return new ProjectDb(this).save();
    }

    public async getOrganisationUnitName(): Promise<string | undefined> {
        const { organisationUnit } = this.data;
        if (!organisationUnit) return;
        const id = _.last(organisationUnit.path.split("/")) || "";

        const { objects } = await this.api.models.organisationUnits
            .get({
                fields: { id: true, displayName: true },
                filter: { id: { eq: id } },
            })
            .getData();

        return objects.length > 0 ? objects[0].displayName : undefined;
    }

    static async getList(
        api: D2Api,
        config: Config,
        filters: FiltersForList,
        pagination: Pagination
    ): Promise<{ objects: ProjectForList[]; pager: Pager }> {
        const order = pagination.sorting
            ? _.thru(pagination.sorting, ([field, order]) => `${field}:i${order}`)
            : undefined;
        const userId = config.currentUser.id;

        return api.models.organisationUnits
            .get({
                paging: true,
                fields: orgUnitFields,
                order: order,
                page: pagination.page,
                pageSize: pagination.pageSize,
                filter: {
                    name: { ilike: filters.search },
                    level: { eq: "3" },
                    "user.id": { eq: filters.createdByCurrentUser ? userId : undefined },
                },
            })
            .getData()
            .then(data => ({ ...data, objects: data.objects.map(getProjectFromOrgUnit) }));
    }

    updateDataElementsSelection(
        dataElementIds: string[]
    ): { related: SelectionUpdate; project: Project } {
        const { related, dataElements } = this.data.dataElements.updateSelection(dataElementIds);
        return { related, project: this.set("dataElements", dataElements) };
    }

    updateDataElementsSelectionForSector(dataElementIds: string[], sectorId: string) {
        const selectedIdsInOtherSectors = this.dataElements
            .get({ onlySelected: true })
            .filter(de => de.sectorId !== sectorId)
            .map(de => de.id);
        const ids = _.union(selectedIdsInOtherSectors, dataElementIds);
        return this.updateDataElementsSelection(ids);
    }

    async validateCodeUniqueness(): Promise<ValidationError> {
        const { api, code } = this;
        if (!code) return [];
        const { organisationUnits } = await api.metadata
            .get({
                organisationUnits: {
                    fields: { displayName: true },
                    filter: { code: { eq: code } },
                },
            })
            .getData();
        const orgUnit = organisationUnits[0];
        return orgUnit
            ? [i18n.t(`There is a project with the same code '${code}': ${orgUnit.displayName}`)]
            : [];
    }
}

interface Project extends ProjectData {}

function getProjectFromOrgUnit(orgUnit: ProjectForList): ProjectForList {
    const process = (s: string, mapper: (d: Moment) => Moment) => toISOString(mapper(moment(s)));
    return {
        ...orgUnit,
        ...(orgUnit.openingDate
            ? { openingDate: process(orgUnit.openingDate, d => d.add(1, "month")) }
            : {}),
        ...(orgUnit.closedDate
            ? { closedDate: process(orgUnit.closedDate, d => d.subtract(1, "month")) }
            : {}),
    };
}

function validatePresence(value: any, field: string): ValidationError {
    const isBlank =
        !value ||
        (value.length !== undefined && value.length === 0) ||
        (value.strip !== undefined && !value.strip());

    return isBlank ? [i18n.t("{{field}} cannot be blank", { field })] : [];
}

function validateNonEmpty(value: any[], field: string): ValidationError {
    return value.length == 0 ? [i18n.t("Select at least one item for {{field}}", { field })] : [];
}

/* eslint-disable @typescript-eslint/no-unused-vars */
function validateNumber(
    value: number,
    field: string,
    { min, max }: { min?: number; max?: number } = {}
): ValidationError {
    if (min && value < min) {
        return [
            i18n.t("{{field}} must be greater than or equal to {{value}}", { field, value: min }),
        ];
    } else if (max && value > max) {
        return [i18n.t("{{field}} must be less than or equal to {{value}}", { field, value: max })];
    } else {
        return [];
    }
}

function validateRegexp(
    value: string,
    field: string,
    regexp: RegExp,
    customMsg: string
): ValidationError {
    return regexp.test(value)
        ? []
        : [
              customMsg ||
                  i18n.t("{{field}} does not match pattern {{pattern}}", {
                      field,
                      pattern: regexp.source,
                  }),
          ];
}

function validateLength(
    value: string,
    field: string,
    { length }: { length?: number } = {}
): ValidationError {
    if (value.length !== 2) {
        return [i18n.t("{{field}} must have {{length}} characters", { field, length })];
    } else {
        return [];
    }
}

function getPeriodIds(dataSet: DataSetWithPeriods): string[] {
    const now = moment();
    const isPeriodInPastOrOpen = (dip: DataInputPeriod) => {
        const periodStart = moment(dip.period.id, monthFormat).startOf("month");
        return periodStart.isBefore(now) || now.isBetween(dip.openingDate, dip.closingDate);
    };

    return _(dataSet.dataInputPeriods)
        .filter(isPeriodInPastOrOpen)
        .map(dip => dip.period.id)
        .sortBy()
        .value();
}

export function getPeriodsData(dataSet: DataSetWithPeriods) {
    const periodIds = getPeriodIds(dataSet);
    const isTarget = dataSet.code.endsWith("TARGET");
    let currentPeriodId;

    if (isTarget) {
        currentPeriodId = _.first(periodIds);
    } else {
        const nowPeriodId = moment().format(monthFormat);
        currentPeriodId = periodIds.includes(nowPeriodId) ? nowPeriodId : _.last(periodIds);
    }

    return { periodIds, currentPeriodId };
}

export default Project;

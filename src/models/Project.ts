import { Config } from "./config";

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

import { Moment } from "moment";
import _ from "lodash";
import { D2Api, SelectedPick, Id, D2OrganisationUnitSchema } from "d2-api";
import { Pagination } from "./../types/ObjectsList";
import { Pager } from "d2-api/api/models";
import i18n from "../locales";
import DataElementsSet, { SelectionUpdate } from "./dataElementsSet";
import ProjectDb from "./ProjectDb";
import { MetadataResponse } from "d2-api/api/metadata";

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
    organisationUnit: OrganisationUnit | undefined;
    dataElements: DataElementsSet;
}

interface NamedObject {
    id: Id;
    displayName: string;
}

export type Sector = NamedObject;
export type Funder = NamedObject;

interface OrganisationUnit {
    path: string;
}

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
    organisationUnit: undefined,
};

const yes = true as const;

const orgUnitFields = {
    id: yes,
    created: yes,
    user: { id: yes, displayName: yes },
    displayName: yes,
    displayDescription: yes,
    href: yes,
    publicAccess: yes,
    lastUpdated: yes,
    openingDate: yes,
    closedDate: yes,
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

    // TODO: create an object {[field: string]: string} with field translations
    validations: Validations = {
        name: () => validatePresence(this.name, i18n.t("Name")),
        startDate: () => validatePresence(this.startDate, i18n.t("Start Date")),
        endDate: () => validatePresence(this.endDate, i18n.t("End Date")),
        code: () => this.validateCodeUniqueness(),
        awardNumber: () =>
            validateRegexp(
                this.awardNumber,
                i18n.t("Award Number"),
                new RegExp(`^\\d{${Project.lengths.awardNumber}}$`),
                i18n.t("Award Number should be a number of 5 digits")
            ),
        subsequentLettering: () =>
            validateLength(this.subsequentLettering, i18n.t("Subsequent Lettering"), {
                length: Project.lengths.subsequentLettering,
            }),
        speedKey: () =>
            validateNumber(this.speedKey.length, i18n.t("Speed Key"), {
                max: Project.lengths.speedKey,
            }),
        sectors: () => validateNonEmpty(this.sectors, i18n.t("Sectors")),
        funders: () => validateNonEmpty(this.funders, i18n.t("Funders")),
        organisationUnit: () =>
            this.organisationUnit ? [] : [i18n.t("One Organisation Unit should be selected")],
        dataElements: () => this.dataElements.validate(this.sectors),
    };

    constructor(public api: D2Api, private data: ProjectData) {
        defineGetters(data, this);
    }

    public set<K extends keyof ProjectData>(field: K, value: ProjectData[K]): Project {
        return new Project(this.api, { ...this.data, [field]: value });
    }

    public setObj<K extends keyof ProjectData>(obj: Pick<ProjectData, K>): Project {
        return new Project(this.api, { ...this.data, ...obj });
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

    static async getData(
        api: D2Api,
        partialData: Omit<ProjectData, "dataElements">
    ): Promise<ProjectData> {
        const dataElements = await DataElementsSet.build(api);
        return { ...partialData, dataElements };
    }

    static async get(api: D2Api, _id: string) {
        return new Project(api, await Project.getData(api, defaultProjectData));
    }

    static async create(api: D2Api) {
        return new Project(api, await Project.getData(api, defaultProjectData));
    }

    save(): Promise<{ response: MetadataResponse; project: Project }> {
        return new ProjectDb(this.api, this).save();
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
        return api.models.organisationUnits
            .get({
                paging: true,
                fields: orgUnitFields,
                order: pagination.sorting
                    ? _.thru(pagination.sorting, ([field, order]) => `${field}:i${order}`)
                    : undefined,
                page: pagination.page,
                pageSize: pagination.pageSize,
                filter: {
                    name: { ilike: filters.search },
                    level: { eq: "4" },
                    "user.id": {
                        eq: filters.createdByCurrentUser ? config.currentUser.id : undefined,
                    },
                },
            })
            .getData();
    }

    updateDataElementsSelection(
        dataElementIds: string[]
    ): { related: SelectionUpdate; project: Project } {
        const { related, dataElements } = this.data.dataElements.updateSelection(dataElementIds);
        return { related, project: this.set("dataElements", dataElements) };
    }

    updateDataElementsSelectionForSector(dataElementIds: string[], sectorId: string) {
        const selectedIdsInOtherSectors = this.dataElements
            .getSelected()
            .filter(de => de.sectorId !== sectorId)
            .map(de => de.id);
        const ids = _.union(selectedIdsInOtherSectors, dataElementIds);
        return this.updateDataElementsSelection(ids);
    }

    async validateCodeUniqueness(): Promise<ValidationError> {
        const { api, code } = this;
        console.log({ request: code });
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

export default Project;

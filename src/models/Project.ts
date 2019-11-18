/*

Project model.

* Get an existing project:

    const existingProject = await Project.get(d2Api, "gr7Fzf5l9F2");

* Create a new project, set fields and validate:

    const project = Project.create(d2Api);
    const projectWithNameAndCode = project
        .set("name", "Project Name")
        .set("code", "PR_1234")

    projectWithNameAndCode.name
    # "Project Name"

    const errors = await projectWithNameAndCode.validate(["name", "code"])
    # {name: []}

    const errors = await projectWithNameAndCode.validate()
    # {
        "name": [],
        "startDate": [
            "Start Date cannot be blank"
        ],
        ...
      }


* Get paginated list of projects:

    const { objects, pager } = await Project.getList(
        d2Api,
        { search: "abc", createdByCurrentUser: true },
        { page: 2, pageSize: 10, sorting: ["displayName", "desc"] }
    )
*/

import { Moment } from "moment";
import _ from "lodash";
import { D2Api, SelectedPick, D2DataSetSchema, Id } from "d2-api";
import { Pagination } from "./../types/ObjectsList";
import { Pager } from "d2-api/api/models";
import i18n from "../locales";
import DataElements from "./data-elements-set";

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
    organisationUnits: OrganisationUnit[];
    dataElements: DataElements;
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
    code: "",
    awardNumber: "",
    subsequentLettering: "",
    speedKey: "",
    startDate: undefined,
    endDate: undefined,
    sectors: [],
    funders: [],
    organisationUnits: [],
};

const true_ = true as true;

const dataSetFieldsForList = {
    id: true_,
    created: true_,
    user: { id: true_, displayName: true_ },
    displayName: true_,
    displayDescription: true_,
    href: true_,
    publicAccess: true_,
    lastUpdated: true_,
};

export type DataSetForList = SelectedPick<D2DataSetSchema, typeof dataSetFieldsForList>;

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

export type ValidationKey = keyof ProjectData;

type ValidationError = string[];
type Validations = { [K in ValidationKey]?: () => ValidationError | Promise<ValidationError> };

class Project {
    // TODO: create an object {[field: string]: string} with field translations to DRY code
    validations: Validations = {
        name: () => validatePresence(this.name, i18n.t("Name")),
        startDate: () => validatePresence(this.startDate, i18n.t("Start Date")),
        endDate: () => validatePresence(this.endDate, i18n.t("End Date")),
        awardNumber: () =>
            validateRegexp(
                this.awardNumber,
                i18n.t("Award Number"),
                /^\d{5}$/,
                i18n.t("Award Number should be a number of 5 digits")
            ),
        subsequentLettering: () =>
            validateLength(this.subsequentLettering, i18n.t("Subsequent Lettering"), {
                length: 2,
            }),
        sectors: () => validateNonEmpty(this.sectors, i18n.t("Sectors")),
        funders: () => validateNonEmpty(this.funders, i18n.t("Funders")),
        organisationUnits: () =>
            validateNonEmpty(this.organisationUnits, i18n.t("Organisation Units")),
    };

    constructor(public api: D2Api, private data: ProjectData) {
        defineGetters(data, this);
    }

    public set<K extends keyof ProjectData>(field: K, value: ProjectData[K]): Project {
        return new Project(this.api, { ...this.data, [field]: value });
    }

    public async validate(
        validationKeys: (ValidationKey)[] | undefined = undefined
    ): Promise<Validations> {
        const obj = _(this.validations)
            .pickBy((_value, key) => !validationKeys || _(validationKeys as string[]).includes(key))
            .mapValues(fn => (fn ? fn.call(this) : []))
            .value();
        const [keys, promises] = _.unzip(_.toPairs(obj));
        const values = await Promise.all(promises);
        return _.fromPairs(_.zip(keys, values)) as Validations;
    }

    static async getData(
        api: D2Api,
        partialData: Omit<ProjectData, "dataElements">
    ): Promise<ProjectData> {
        const dataElements = await DataElements.build(api);
        return { ...partialData, dataElements };
    }

    static async get(api: D2Api, _id: string) {
        return new Project(api, await Project.getData(api, defaultProjectData));
    }

    static async create(api: D2Api) {
        return new Project(api, await Project.getData(api, defaultProjectData));
    }

    public async getOrganisationUnitsWithName() {
        const ids = this.data.organisationUnits.map(ou => _.last(ou.path.split("/")) || "");
        return this.api.models.organisationUnits
            .get({
                fields: { id: true, displayName: true },
                filter: { id: { in: ids } },
                pageSize: 20,
            })
            .getData();
    }

    static async getList(
        api: D2Api,
        filters: FiltersForList,
        pagination: Pagination
    ): Promise<{ objects: DataSetForList[]; pager: Pager }> {
        const currentUser = await api.currrentUser.get().getData();
        currentUser.displayName;

        return api.models.dataSets
            .get({
                paging: true,
                fields: dataSetFieldsForList,
                order: pagination.sorting
                    ? _.thru(pagination.sorting, ([field, order]) => `${field}:i${order}`)
                    : undefined,
                page: pagination.page,
                pageSize: pagination.pageSize,
                filter: {
                    name: { ilike: filters.search },
                    "user.id": { eq: filters.createdByCurrentUser ? currentUser.id : undefined },
                },
            })
            .getData();
    }

    updateDataElementSelection(dataElementIds: string[]): Project {
        const dataElementsUpdated = this.data.dataElements.updateSelection(dataElementIds);
        console.log({ dataElementsUpdated, dataElementIds });
        return this.set("dataElements", dataElementsUpdated);
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
        return [i18n.t("{{field}} must be greater than {{value}}", { field, value: min })];
    } else if (max && value > max) {
        return [i18n.t("{{field}} must be less than {{value}}", { field, value: max })];
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

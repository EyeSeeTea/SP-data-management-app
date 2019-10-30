import { Moment } from "moment";
import _ from "lodash";
import { D2Api, SelectedPick, D2DataSetSchema, Id } from "d2-api";
import { Pagination } from "./../types/ObjectsList";
import { Pager } from "d2-api/api/models";
import i18n from "../locales";

export interface ProjectData {
    name: string;
    description: string;
    code: string;
    awardNumber: string;
    subsequentLettering: string;
    speedKey: string;
    startDate?: Moment;
    endDate?: Moment;
    sectors: Sector[];
    funders: Funder[];
    organisationUnits: OrganisationUnit[];
}

interface NamedObject {
    id: Id;
    displayName: string;
}

export type Sector = NamedObject;
export type Funder = NamedObject;

interface OrganisationUnit {
    id: Id;
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
        Object.defineProperty(targetObject.prototype, key, {
            get: () => sourceObject[key],
            enumerable: true,
            configurable: true,
        });
    });
}

export type ValidationKey =
    | "name"
    | "startDate"
    | "endDate"
    | "awardNumber"
    | "subsequentLettering"
    | "sectors"
    | "funders"
    | "organisationUnits";

type ValidationError = string[];
type Validations = { [K in ValidationKey]: () => ValidationError | Promise<ValidationError> };

class Project {
    validations: Validations = {
        name: () => validatePresence(this.name, i18n.t("Name")),
        startDate: () => validatePresence(this.startDate, i18n.t("Start Date")),
        endDate: () => validatePresence(this.endDate, i18n.t("End Date")),
        awardNumber: () => validatePresence(this.awardNumber, i18n.t("Award Number")),
        subsequentLettering: () =>
            validatePresence(this.subsequentLettering, i18n.t("Subsequent Lettering")),
        sectors: () => validateNonEmpty(this.sectors, i18n.t("Sectors")),
        funders: () => validateNonEmpty(this.funders, i18n.t("Funders")),
        organisationUnits: () =>
            validateNonEmpty(this.organisationUnits, i18n.t("Organisation Units")),
    };

    constructor(public api: D2Api, private data: ProjectData) {
        defineGetters(data, Project);
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

    static async get(api: D2Api, _id: string) {
        return new Project(api, defaultProjectData);
    }

    static create(api: D2Api) {
        return new Project(api, defaultProjectData);
    }

    public async getOrganisationUnitsWithName() {
        const ids = this.data.organisationUnits.map(ou => ou.id);
        return this.api.models.organisationUnits
            .get({
                fields: { id: true, path: true, displayName: true },
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
    return value.length == 0 ? [i18n.t("{{field}}: Select at least one item", { field })] : [];
}

export default Project;

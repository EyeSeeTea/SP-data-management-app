import { Moment } from "moment";
import _ from "lodash";
import { D2Api, SelectedPick, D2DataSetSchema } from "d2-api";
import { Pagination } from "./../types/ObjectsList";
import { Pager } from "d2-api/api/models";
import i18n from "../locales";

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

export interface ProjectData {
    name: string;
    description: string;
    code: string;
    awardNumber: string;
    subsequentLettering: string;
    speedKey: string;
    startDate?: Moment;
    endDate?: Moment;
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
};

function defineGetters(SourceObject: any, targetObject: any) {
    Object.keys(SourceObject).forEach(function(key) {
        Object.defineProperty(targetObject.prototype, key, {
            get: function() {
                return SourceObject[key];
            },
            enumerable: true,
            configurable: true,
        });
    });
}

export type ValidationKey = "name" | "startDate" | "endDate";
type ValidationError = string[];
type Validations = { [K in ValidationKey]: () => ValidationError | Promise<ValidationError> };

class Project {
    validations: Validations = {
        name: this.validateName,
        startDate: this.validateStartDate,
        endDate: this.validateEndDate,
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

    private validateName(): ValidationError {
        return validatePresence(this.name, i18n.t("Name"));
    }

    private validateStartDate(): ValidationError {
        return validatePresence(this.startDate, i18n.t("Start Date"));
    }

    private validateEndDate(): ValidationError {
        return validatePresence(this.endDate, i18n.t("End Date"));
    }

    static async get(api: D2Api, _id: string) {
        return new Project(api, defaultProjectData);
    }

    static create(api: D2Api) {
        return new Project(api, defaultProjectData);
    }

    static async getList(
        api: D2Api,
        filters: FiltersForList,
        pagination: Pagination
    ): Promise<{ objects: DataSetForList[]; pager: Pager }> {
        const currentUser = await api.currrentUser.get().getData();

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
    return !value ? [i18n.t("Field {{field}} cannot be blank", { field })] : [];
}

export default Project;

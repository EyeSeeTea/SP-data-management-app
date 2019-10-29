import _ from "lodash";
import { D2Api, SelectedPick, D2DataSetSchema } from "d2-api";
import { Pagination } from "./../types/ObjectsList";
import { Pager } from "d2-api/api/models";

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

export default class Project {
    constructor(public api: D2Api) {}

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

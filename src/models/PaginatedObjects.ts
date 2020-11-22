export interface PaginatedObjects<T> {
    pager: Pager;
    objects: T[];
}

export interface Pager {
    page: number;
    pageCount: number;
    total: number;
    pageSize: number;
}

export interface Paging {
    page: number;
    pageSize: number;
}

export interface Sorting<T> {
    field: keyof T;
    order: "asc" | "desc";
}

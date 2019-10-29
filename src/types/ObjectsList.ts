export interface Pagination {
    page: number;
    pageSize: number;
    paging: boolean;
    sorting: [string, "asc" | "desc"];
}

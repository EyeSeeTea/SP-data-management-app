export interface Pagination {
    page: number;
    pageSize: number;
    sorting: [string, "asc" | "desc"];
}

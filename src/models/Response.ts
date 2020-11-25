export type Response<Data> = { type: "success"; data: Data } | { type: "error"; message: string };

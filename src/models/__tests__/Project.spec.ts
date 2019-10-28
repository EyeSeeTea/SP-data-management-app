import Project from "../Project";
import { D2Api, D2ApiMock, getMockApi } from "d2-api";

const dataSetsPaginated = {
    pager: {
        page: 1,
        pageCount: 3,
        total: 12,
        pageSize: 5,
    },
    dataSets: [{ id: "1234a" }, { id: "1234b" }],
};

const currentUser = {
    id: "xE7jOejl9FI",
    displayName: "John Traore",
};

const baseRequest = {
    paging: true,
    fields:
        "id,created,user[id,displayName],displayName,displayDescription,href,publicAccess,lastUpdated",
    order: "displayName:idesc",
    page: 1,
    pageSize: 10,
    filter: [],
};

const { api, mock } = getMockApi();

describe("Project", () => {
    beforeEach(() => {
        mock.reset();
        mock.onGet("/me").reply(200, currentUser);
    });

    describe("getList", () => {
        it("returns list of dataSets", async () => {
            mock.onGet("/dataSets", {
                params: { ...baseRequest, filter: [] },
            }).reply(200, dataSetsPaginated);

            const { objects, pager } = await Project.getList(
                api,
                {},
                { page: 1, pageSize: 10, paging: true, sorting: ["displayName", "desc"] }
            );
            expect(pager).toEqual(dataSetsPaginated.pager);
            expect(objects).toEqual(dataSetsPaginated.dataSets);
        });

        it("returns list of dataSets filtered", async () => {
            mock.onGet("/dataSets", {
                params: {
                    ...baseRequest,
                    filter: ["name:ilike:abc", "user.id:eq:xE7jOejl9FI"],
                },
            }).reply(200, dataSetsPaginated);

            const { objects, pager } = await Project.getList(
                api,
                { search: "abc", createdByCurrentUser: true },
                { page: 1, pageSize: 10, paging: true, sorting: ["displayName", "desc"] }
            );
            expect(pager).toEqual(dataSetsPaginated.pager);
            expect(objects).toEqual(dataSetsPaginated.dataSets);
        });
    });
});

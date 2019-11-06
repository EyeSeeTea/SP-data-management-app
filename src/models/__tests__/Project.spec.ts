import { ProjectData } from "./../Project";
import Project from "../Project";
import { getMockApi } from "d2-api";

const currentUser = {
    id: "xE7jOejl9FI",
    displayName: "John Traore",
};

const { api, mock } = getMockApi();

async function expectFieldPresence(field: keyof ProjectData) {
    const project = Project.create(api);
    const errors = await project.validate([field]);
    expect(errors[field] !== undefined && (errors[field] || []).length > 0).toBeTruthy();
}

async function expectNumberAwardNumber(field: keyof ProjectData) {
    const project = Project.create(api).set(field, 22222);
    const errors = await project.validate([field]);
    expect(errors[field]).toHaveLength(0);

    const project2 = project.set(field, 22);
    const errors2 = await project2.validate([field]);
    expect(errors2[field]).toHaveLength(1);
    expect(errors2[field]).toContain("Award Number must be greater than 10000");

    const project3 = project.set(field, 222222);
    const errors3 = await project3.validate([field]);
    expect(errors3[field]).toHaveLength(1);
    expect(errors3[field]).toContain("Award Number must be less than 99999");
}

async function expectCharactersSubsequentLettering(field: keyof ProjectData) {
    const project = Project.create(api).set(field, "NG");
    const errors = await project.validate([field]);
    expect(errors[field]).toHaveLength(0);

    const project2 = project.set(field, "N");
    const errors2 = await project2.validate([field]);
    expect(errors2[field]).toHaveLength(1);
    expect(errors2[field]).toContain("Subsequent Lettering must have 2 characters");

    const project3 = project.set(field, "NGO");
    const errors3 = await project3.validate([field]);
    expect(errors3[field]).toHaveLength(1);
    expect(errors3[field]).toContain("Subsequent Lettering must have 2 characters");
}

describe("Project", () => {
    describe("set", () => {
        it("sets immutable data fields using field name", () => {
            const project1 = Project.create(api);
            const project2 = project1.set("name", "Project name");
            expect(project1.name).toEqual("");
            expect(project2.name).toEqual("Project name");
        });
    });

    describe("create", () => { });

    describe("get", () => { });

    describe("getOrganisationUnitsWithName", () => {
        const paginatedOrgUnits = {
            pager: { page: 1, pageSize: 10, pageCount: 1, total: 0 },
            organisationUnits: [],
        };

        beforeEach(() => {
            mock.onGet("/organisationUnits", {
                params: {
                    fields: "displayName,id",
                    filter: ["id:in:[1,2,3]"],
                    pageSize: 20,
                },
            }).reply(200, paginatedOrgUnits);
        });
        it("gets paginated organisation units with display name", async () => {
            const project1 = Project.create(api);
            const orgUnits = [{ path: "/1" }, { path: "/1/2" }, { path: "/1/3" }];
            const project2 = project1.set("organisationUnits", orgUnits);
            const { pager, objects } = await project2.getOrganisationUnitsWithName();

            expect(pager).toEqual(paginatedOrgUnits.pager);
            expect(objects).toEqual(paginatedOrgUnits.organisationUnits);
        });
    });

    describe("validate", () => {
        it("requires a name", async () => {
            expectFieldPresence("name");
        });

        it("requires a start date", async () => {
            expectFieldPresence("startDate");
        });

        it("requires a end date", async () => {
            expectFieldPresence("endDate");
        });

        it("requires an award number", async () => {
            expectFieldPresence("awardNumber");
        });

        it("requires a number with five digits in award number", async () => {
            expectNumberAwardNumber("awardNumber");
        });

        it("requires a subsequent lettering", async () => {
            expectFieldPresence("subsequentLettering");
        });

        it("requires a string with 2 characters in subsequent lettering", async () => {
            expectCharactersSubsequentLettering("awardNumber");
        });

        it("requires at least one sector", async () => {
            expectFieldPresence("sectors");
        });

        it("requires at least one funder", async () => {
            expectFieldPresence("funders");
        });

        it("requires at least one organisation unit", async () => {
            expectFieldPresence("organisationUnits");
        });
    });

    describe("getList", () => {
        const dataSetsPaginated = {
            pager: {
                page: 1,
                pageCount: 3,
                total: 12,
                pageSize: 5,
            },
            dataSets: [{ id: "1234a" }, { id: "1234b" }],
        };

        const baseRequest = {
            paging: true,
            fields:
                "created,displayDescription,displayName,href,id,lastUpdated,publicAccess,user[displayName,id]",
            order: "displayName:idesc",
            page: 1,
            pageSize: 10,
            filter: [],
        };

        beforeEach(() => {
            mock.reset();
            mock.onGet("/me").reply(200, currentUser);
        });

        it("returns list of dataSets", async () => {
            mock.onGet("/dataSets", {
                params: { ...baseRequest, filter: [] },
            }).reply(200, dataSetsPaginated);

            const { objects, pager } = await Project.getList(
                api,
                {},
                { page: 1, pageSize: 10, sorting: ["displayName", "desc"] }
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
                { page: 1, pageSize: 10, sorting: ["displayName", "desc"] }
            );

            expect(pager).toEqual(dataSetsPaginated.pager);
            expect(objects).toEqual(dataSetsPaginated.dataSets);
        });
    });
});

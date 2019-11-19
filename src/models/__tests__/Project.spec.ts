import { getMockApi } from "d2-api";
import { baseConfig, Config } from "./../config";
import { ProjectData } from "./../Project";
import Project from "../Project";

const config: Config = {
    ...baseConfig,
    currentUser: {
        id: "xE7jOejl9FI",
        userRoles: [],
        organisationUnits: [
            {
                id: "ueuQlqb8ccl",
                displayName: " Panderu MCHP",
            },
        ],
    },
};

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

describe("Project", () => {
    describe("set", () => {
        it("sets immutable data fields using field name", () => {
            const project1 = Project.create(api);
            const project2 = project1.set("name", "Project name");
            expect(project1.name).toEqual("");
            expect(project2.name).toEqual("Project name");
        });
    });

    describe("create", () => {});

    describe("get", () => {});

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

        it("requires a number with five digits in award number", async () => {
            const project = Project.create(api).set("awardNumber", "22222");
            const errors = await project.validate(["awardNumber"]);
            expect(errors["awardNumber"]).toHaveLength(0);

            const project2 = project.set("awardNumber", "22");
            const errors2 = await project2.validate(["awardNumber"]);
            expect(errors2["awardNumber"]).toHaveLength(1);
            expect(errors2["awardNumber"]).toContain("Award Number should be a number of 5 digits");

            const project3 = project.set("awardNumber", "222222");
            const errors3 = await project3.validate(["awardNumber"]);
            expect(errors3["awardNumber"]).toHaveLength(1);
            expect(errors3["awardNumber"]).toContain("Award Number should be a number of 5 digits");
        });

        it("requires a string with 2 characters in subsequent lettering", async () => {
            const project = Project.create(api).set("subsequentLettering", "NG");
            const errors = await project.validate(["subsequentLettering"]);
            expect(errors["subsequentLettering"]).toHaveLength(0);

            const project2 = project.set("subsequentLettering", "N");
            const errors2 = await project2.validate(["subsequentLettering"]);
            expect(errors2["subsequentLettering"]).toHaveLength(1);
            expect(errors2["subsequentLettering"]).toContain(
                "Subsequent Lettering must have 2 characters"
            );

            const project3 = project.set("subsequentLettering", "NGO");
            const errors3 = await project3.validate(["subsequentLettering"]);
            expect(errors3["subsequentLettering"]).toHaveLength(1);
            expect(errors3["subsequentLettering"]).toContain(
                "Subsequent Lettering must have 2 characters"
            );
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
                config,
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
                config,
                { search: "abc", createdByCurrentUser: true },
                { page: 1, pageSize: 10, sorting: ["displayName", "desc"] }
            );

            expect(pager).toEqual(dataSetsPaginated.pager);
            expect(objects).toEqual(dataSetsPaginated.dataSets);
        });
    });
});

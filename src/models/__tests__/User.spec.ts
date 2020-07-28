import { Config } from "./../Config";
import User from "../user";
import config from "./config";

describe("User permissions", () => {
    it("Admin can perform all actions", () => {
        const adminConfig = getConfigForUserWithRole("DM Admin");
        const user = new User(adminConfig);

        expect(user.hasRole("admin")).toBe(true);

        expect(user.can("create")).toBe(true);
        expect(user.can("accessMER")).toBe(true);
        expect(user.can("actualValues")).toBe(true);
        expect(user.can("targetValues")).toBe(true);
        expect(user.can("dashboard")).toBe(true);
        expect(user.can("downloadData")).toBe(true);
        expect(user.can("edit")).toBe(true);
        expect(user.can("dataApproval")).toBe(true);
        expect(user.can("delete")).toBe(true);
    });

    it("Data Reviewer can perform all actions except deletion", () => {
        const dataReviewerConfig = getConfigForUserWithRole("Data Reviewer");
        const user = new User(dataReviewerConfig);

        expect(user.hasRole("dataReviewer")).toBe(true);

        expect(user.can("create")).toBe(true);
        expect(user.can("accessMER")).toBe(true);
        expect(user.can("actualValues")).toBe(true);
        expect(user.can("targetValues")).toBe(true);
        expect(user.can("dashboard")).toBe(true);
        expect(user.can("downloadData")).toBe(true);
        expect(user.can("edit")).toBe(true);
        expect(user.can("dataApproval")).toBe(true);
        expect(user.can("delete")).toBe(false);
    });

    it("Data Viewer can access dashboard and download data", () => {
        const dataVewerConfig = getConfigForUserWithRole("Data Viewer");
        const user = new User(dataVewerConfig);

        expect(user.hasRole("dataViewer")).toBe(true);

        expect(user.can("create")).toBe(false);
        expect(user.can("accessMER")).toBe(false);
        expect(user.can("actualValues")).toBe(false);
        expect(user.can("targetValues")).toBe(false);
        expect(user.can("dashboard")).toBe(true);
        expect(user.can("downloadData")).toBe(true);
        expect(user.can("edit")).toBe(false);
        expect(user.can("dataApproval")).toBe(false);
        expect(user.can("delete")).toBe(false);
    });

    it("Data Entry can access actual/target values, dashboard and download data", () => {
        const dataEntryConfig = getConfigForUserWithRole("Data Entry");
        const user = new User(dataEntryConfig);

        expect(user.hasRole("dataEntry")).toBe(true);

        expect(user.can("create")).toBe(false);
        expect(user.can("accessMER")).toBe(false);
        expect(user.can("actualValues")).toBe(true);
        expect(user.can("targetValues")).toBe(true);
        expect(user.can("dashboard")).toBe(true);
        expect(user.can("downloadData")).toBe(true);
        expect(user.can("edit")).toBe(false);
        expect(user.can("dataApproval")).toBe(false);
        expect(user.can("delete")).toBe(false);
    });
});

function getConfigForUserWithRole(roleName: string): Config {
    return {
        ...config,
        currentUser: { ...config.currentUser, userRoles: [{ name: roleName }] },
    };
}

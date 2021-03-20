import _ from "lodash";
import { runAndWaitForRequest } from "../support/utils";

const projectName = "00Cypress Project";

describe("Project Configuration - List page", () => {
    beforeEach(() => {
        cy.login("admin");
        cy.loadPage();
    });

    it("shows list of user projects", () => {
        cy.contains(projectName);
    });

    it("opens contextual menu when left button mouse is clicked", () => {
        cy.contains(projectName).click();

        cy.contains("Details");
        cy.contains("Add Actual Values");
        cy.contains("Go to Project Dashboard (current)");
        cy.contains("Add Target Values");
        cy.contains("Download Data");
        cy.contains("Edit");
        cy.contains("Delete");
    });

    it("shows details when details action is clicked", () => {
        cy.contains(projectName).trigger("contextmenu");
        cy.contains("Details").click();

        cy.contains("Name");
        cy.contains("Award Number");
        cy.contains("Description");
        cy.contains("Last Updated");
        cy.contains("Last Updated By");
        cy.contains("Created");
        cy.contains("Created By");
        cy.contains("Start Date");
        cy.contains("End Date");
        cy.contains("API Link");
    });

    it("opens contextual menu when right button mouse is clicked", () => {
        cy.contains(projectName).trigger("contextmenu");

        cy.contains("Details");
        cy.contains("Add Actual Values");
        cy.contains("Go to Project Dashboard (current)");
        cy.contains("Add Target Values");
        cy.contains("Download Data");
        cy.contains("Edit");
        cy.contains("Delete");
    });

    it("shows list of projects sorted alphabetically", () => {
        cy.get(".MuiTableBody-root tr > td:nth-child(2)").then(el => {
            const names = el.get().map(x => x.innerText);
            const sortedNames = _(names)
                .orderBy(name => name.toLowerCase())
                .value();
            assert.isTrue(_.isEqual(names, sortedNames));
        });
    });

    it("shows list of projects sorted alphabetically by name desc", () => {
        cy.get("[data-test-loaded]");
        runAndWaitForRequest("/api/metadata*", () => {
            cy.contains("Name").click();
        });

        cy.get(".MuiTableBody-root tr > td:nth-child(2)").then(el => {
            const names = el.get().map(x => x.innerText);
            const sortedNames = _(names)
                .orderBy(name => name.toLowerCase())
                .reverse()
                .value();
            console.log({ names, sortedNames });
            assert.isTrue(_.isEqual(names, sortedNames));
        });
    });

    it("can filter projects by name", () => {
        cy.get("[placeholder='Search by name or code']").clear().type("Non existing name 1234$%&");

        cy.contains("No results found");
    });
});

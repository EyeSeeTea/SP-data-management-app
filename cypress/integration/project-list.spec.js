import _ from "lodash";

describe("Project Configuration - List page", () => {
    beforeEach(() => {
        cy.login("admin");
        cy.loadPage();
    });

    it("shows list of user projects", () => {
        cy.contains("00Cypress Project");
    });

    it("opens details window when mouse clicked", () => {
        cy.contains("00Cypress Project").click();
        cy.get(".MuiPaper-root:nth-child(2)").within(() => {
            cy.contains("Name");
            cy.contains("Code");
            cy.contains("Description");
            cy.contains("Last Updated");
            cy.contains("Last Updated By");
            cy.contains("Created");
            cy.contains("Created By");
            cy.contains("Opening Date");
            cy.contains("Closed Date");
            cy.contains("API Link");
        });
    });

    it("opens context window when right button mouse is clicked", () => {
        cy.contains("00Cypress Project").trigger("contextmenu");

        cy.contains("Details");
        cy.contains("Add Actual Values");
        cy.contains("Go to Dashboard");
        cy.contains("Reopen Datasets");
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
        runAndWaitForRequest("/api/*", () => {
            cy.contains("Name").click();
        });

        cy.get(".MuiTableBody-root tr > td:nth-child(2)").then(el => {
            const names = el.get().map(x => x.innerText);
            const sortedNames = _(names)
                .orderBy(name => name.toLowerCase())
                .reverse()
                .value();
            assert.isTrue(_.isEqual(names, sortedNames));
        });
    });

    it("can filter projects by name", () => {
        cy.get("[placeholder='Search by name']")
            .clear()
            .type("Non existing name 1234$%&");

        cy.contains("No results found");
    });
});

function runAndWaitForRequest(urlPattern, action) {
    cy.server()
        .route("GET", urlPattern)
        .as(urlPattern);

    action();

    cy.wait("@" + urlPattern);
}

import _ from "lodash";

describe("Project Configuration - List page", () => {
    beforeEach(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("Project Configuration").click();
    });

    it("shows list of user projects", () => {
        cy.get(".data-table__rows > :nth-child(1) > :nth-child(4) span").should("not.be.empty");
    });

    it("opens details window when mouse clicked", () => {
        cy.get(".data-table__rows > :nth-child(1) > :nth-child(4) span").click();
        cy.get(".detail-field").contains("Name");
        cy.get(".detail-field").contains("Code");
        cy.get(".detail-field").contains("Description");
        cy.get(".detail-field").contains("Last Updated");
        cy.get(".detail-field").contains("Last Updated By");
        cy.get(".detail-field").contains("Created");
        cy.get(".detail-field").contains("Created By");
        cy.get(".detail-field").contains("Opening Date");
        cy.get(".detail-field").contains("Closed Date");
        cy.get(".detail-field").contains("API Link");
    });

    it("opens context window when right button mouse is clicked", () => {
        cy.get(".data-table__rows > :nth-child(1) > :nth-child(4) span")
            .first()
            .trigger("contextmenu");

        cy.contains("Details");
        cy.contains("Add Actual Values");
        cy.contains("Go to Dashboard");
        cy.contains("Add Target Values");
        cy.contains("Download Data");
        cy.contains("Generate / Configure MER");
        cy.contains("Edit");
        cy.contains("Delete");
    });

    it("shows list of user dataset sorted alphabetically", () => {
        cy.get("[data-test='displayName-sorting-asc']");
        cy.get(".data-table__rows > * > :nth-child(2) span").then(spans$ => {
            const names = spans$.get().map(x => x.innerText);
            const sortedNames = _(names)
                .orderBy(name => name.toLowerCase())
                .value();
            assert.isTrue(_.isEqual(names, sortedNames));
        });
    });

    it("shows list of user dataset sorted alphabetically by name desc", () => {
        runAndWaitForRequest("/api/*", () => cy.contains("Name").click());

        cy.get("[data-test='displayName-sorting-desc']");
        cy.get(".data-table__rows > * > :nth-child(2) span").then(spans$ => {
            const names = spans$.get().map(x => x.innerText);
            const sortedNames = _(names)
                .orderBy(name => name.toLowerCase())
                .reverse()
                .value();
            assert.isTrue(_.isEqual(names, sortedNames));
        });

        it("shows list of user dataset sorted alphabetically by name desc", () => {
            cy.contains("Name").click();
            cy.get("[data-test='displayName-sorting-desc']");

            cy.get(".data-table__rows > * > :nth-child(2) span").then(spans$ => {
                const names = spans$.get().map(x => x.innerText);
                const sortedNames = _(names)
                    .orderBy(name => name.toLowerCase())
                    .reverse()
                    .value();
                assert.isTrue(_.isEqual(names, sortedNames));
            });
        });

        it("can filter datasets by name", () => {
            cy.get("[data-test='search'] input")
                .clear()
                .type("cypress test");

            cy.contains("No results found");
        });

        it("will navegate to dashboard from the actions menu", () => {
            cy.get(".data-table__rows > :nth-child(1) button").click();
            cy.get("span[role=menuitem]")
                .contains("Go to Dashboard")
                .click();

            cy.get("h5").contains("Dashboard");
            cy.url().should("include", "/dashboard");
        });

        it("will navegate to actual values from the actions menu", () => {
            cy.get(".data-table__rows > :nth-child(1) button").click();
            cy.get("span[role=menuitem]")
                .contains("Add Actual Values")
                .click();

            cy.get("h5").contains("Set Actual Values for Project");
            cy.url().should("include", "/actual-values/");
        });
    });

    function runAndWaitForRequest(urlPattern, action) {
        cy.server()
            .route("GET", urlPattern)
            .as(urlPattern);

        action();

        cy.wait("@" + urlPattern);
    }
});

import _ from "lodash";
import { runAndWaitForRequest } from "../support/utils";

const countryName = "Bahamas";

describe("Countries List page", () => {
    beforeEach(() => {
        cy.login("admin");
        cy.loadPage();
        cy.get("[data-test='list-selector-countries']").click();
    });

    it("shows list of countries", () => {
        cy.contains(countryName);
    });

    it("shows details when details action is clicked", () => {
        cy.contains(countryName).trigger("contextmenu");
        cy.contains("Details").click();

        cy.contains("Name");
        cy.contains("Last Updated");
        cy.contains("Created");
    });

    it("opens contextual menu when right button mouse is clicked", () => {
        cy.contains(countryName).trigger("contextmenu");

        cy.contains("Details");
        cy.contains("Go to Dashboard");
    });

    it("shows list of countries sorted alphabetically", () => {
        cy.get(".MuiTableBody-root tr > td:nth-child(2)").then(el => {
            const names = el.get().map(x => x.innerText);
            const sortedNames = _(names)
                .orderBy(name => name.toLowerCase())
                .value();
            assert.isTrue(_.isEqual(names, sortedNames));
        });
    });

    it("shows list of countries sorted alphabetically by name desc", () => {
        cy.get("[data-test-loaded]");
        runAndWaitForRequest("/api/organisationUnits*", () => {
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

    it("can filter countries by name", () => {
        cy.get("[placeholder='Search by name or code']")
            .clear()
            .type("Non existing name 1234$%&");

        cy.contains("No results found");
    });
});

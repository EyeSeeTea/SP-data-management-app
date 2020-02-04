import moment from "moment";

const projectYear = moment().year() + 1;

describe("Projects - Edit", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("00Cypress Project").trigger("contextmenu");
        cy.contains("Edit").click();
    });

    it("gets data from the user to edit a project", () => {
        cy.contains("Edit project");

        cy.waitForStep("General info");
        cy.contains("Funders");
        cy.contains("Next").click();

        cy.waitForStep("Country & Project Locations");
        cy.contains("Next").click();

        cy.waitForStep("Sectors");
        cy.contains("Next").click();

        cy.waitForStep("Selection of Indicators");
        cy.contains("Next").click();

        cy.waitForStep("Selection of MER Indicators");
        cy.contains("Next").click();

        cy.waitForStep("Summary and Save");

        cy.contains("Name");
        cy.contains("00Cypress Project");
        cy.contains("Period dates");
        cy.contains(`February 1, ${projectYear} -> June 30, ${projectYear}`);
        cy.contains("Description");
        cy.contains("Selected country");
        cy.contains("Bahamas");
        cy.contains("Sectors");

        cy.get("[data-wizard-contents] button")
            .contains("Save")
            .click();

        cy.contains("Project saved", { timeout: 20000 });
    });
});

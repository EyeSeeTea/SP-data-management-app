import moment from "moment";

describe("Projects - Edit", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("00Cypress Project").trigger("contextmenu");
        cy.contains("Edit").click();
    });

    it("gets data from the user to edit a project", () => {
        const startDate = moment();
        const endDate = moment().add(3, "months");

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

        cy.waitForStep("Disaggregation");
        cy.contains("Next").click();

        cy.waitForStep("Selection of MER Indicators");
        cy.contains("Next").click();

        cy.waitForStep("Username Access");
        cy.contains("Next").click();

        cy.waitForStep("Summary and Save");

        cy.contains("Name");
        cy.contains("00Cypress Project");

        cy.contains("Period dates");
        const start = `${startDate.format("MMMM")} ${startDate.format("YYYY")}`;
        const end = `${endDate.format("MMMM")} ${endDate.format("YYYY")}`;
        cy.contains(start + " - " + end);

        cy.contains("Description");
        cy.contains("Selected country");
        cy.contains("Bahamas");
        cy.contains("Sectors");

        cy.server()
            .route({ method: "post", url: "/api/email/notification*" })
            .as("sendEmail");

        cy.get("[data-wizard-contents] button")
            .contains("Save")
            .click();

        cy.contains("Project updated");
        cy.wait("@sendEmail");
    });
});

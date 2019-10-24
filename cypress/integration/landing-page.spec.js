/// <reference types='Cypress' />

context("Landing page", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
    });

    it("has page title", () => {
        cy.title().should("equal", "Project Monitoring App");
    });

    it("shows the main sections of the app", () => {
        cy.contains("Project Configuration");
        cy.contains("Monthly Executive Report");
        cy.contains("Data Entry");
        cy.contains("Dashboard");
    });
});

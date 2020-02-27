describe("Projects - Delete", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("00Cypress Project").trigger("contextmenu");
        cy.contains("Delete").click();
    });

    it("asks confirmation and deletes", () => {
        cy.contains("Are you sure").click();
        cy.contains("Proceed").click();

        cy.contains("1 projects deleted");
    });
});

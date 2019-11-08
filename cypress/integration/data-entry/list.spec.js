describe("Data Entry", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("Data Entry").click();
        cy.contains("Data Entry");
    });

    it("should have a help button", () => {
        cy.get('[data-test="Data Entry"').click();
        cy.get("h5").contains("Data Entry");
        cy.url().should("include", "/data-entry");
    });
});

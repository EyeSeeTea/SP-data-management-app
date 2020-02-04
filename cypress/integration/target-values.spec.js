describe("Target Values", () => {
    beforeEach(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("00Cypress Project").trigger("contextmenu");
        cy.contains("Add Target Values").click();
    });

    it("should have a title and correct url", () => {
        cy.get("h5").contains("Set Target Values for Project");
    });
});

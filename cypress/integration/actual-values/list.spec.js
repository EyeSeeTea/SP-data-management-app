describe("Actual Values", () => {
    beforeEach(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("Project Configuration").click();
        cy.get(".data-table__rows > :nth-child(1) > :nth-child(4) span")
            .first()
            .trigger("contextmenu");
        cy.contains("Add Actual Values").click();
    });

    it("should have a title and correct url", () => {
        cy.get('[data-test="Set Actual Values for Project"').click();
        cy.get("h5").contains("Set Actual Values for Project");
        cy.url().should("include", "/actual-values");
    });

    it("should have an iframe", () => {
        cy.get("iframe");
    });
});

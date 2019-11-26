describe("Target Values", () => {
    beforeEach(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("Project Configuration").click();
        cy.get(".data-table__rows > :nth-child(1) > :nth-child(4) span")
            .first()
            .trigger("contextmenu");
        cy.contains("Add Target Values").click();
    });

    it("should have a title and correct url", () => {
        cy.get('[data-test="Set Target Values for Project"').click();
        cy.get("h5").contains("Set Target Values for Project");
        cy.url().should("include", "/target-values");
    });
});

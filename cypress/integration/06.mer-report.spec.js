describe("Report", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("MER Reports").click();
        cy.contains("Monthly Executive Report");
    });

    it("should have a title", () => {
        cy.get("h5").contains("Monthly Executive Reports");
    });
});

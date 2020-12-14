describe("Dashboard", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("00Cypress Project").trigger("contextmenu");
        cy.contains("Dashboard").click();
    });

    it("should have title and correct url", () => {
        cy.get("h5").contains("Project dashboard");
    });

    it("should have an iframe", () => {
        cy.get("iframe");
    });
});

describe("Dashboard", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("Dashboard").click();
        cy.contains("Dashboard");
    });

    it("should have title and correct url", () => {
        cy.get("h5").contains("Dashboard");
    });

    it("should have an iframe", () => {
        cy.get("iframe");
    });
});

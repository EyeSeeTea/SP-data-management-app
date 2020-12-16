describe("Dashboard", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
        cy.get("[data-test='list-selector-countries']").click();
        cy.contains("Bahamas").trigger("contextmenu");
        cy.contains("Go to Dashboard").click();
    });

    it("should have title and correct url", () => {
        cy.get("h5").contains("Country dashboard");
    });

    it("should have an iframe", () => {
        cy.get("iframe");
    });
});

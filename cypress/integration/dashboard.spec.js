describe("Dashboard", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
        cy.get(".data-table__rows > :nth-child(1) > :nth-child(4) span")
            .first()
            .trigger("contextmenu");
        cy.contains("Dashboard").click();
    });

    it("should have title and correct url", () => {
        cy.get("h5").contains("Dashboard");
    });

    it("should have an iframe", () => {
        cy.get("iframe");
    });
});

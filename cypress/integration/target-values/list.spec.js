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

    it("should have a help button", () => {
        cy.get('[data-test="Set Target Values for Project"').click();
        cy.get("h5").contains("Target Values");
        cy.get("button").title("Help");
        cy.url().should("include", "/target-values");
    });

    it("should have an iframe button", () => {
        cy.get("iframe");
        cy.get("input")
            .id("selectedOrganisationUnit")
            .value("Test with SP");
        cy.get("select")
            .id("selectedDataSetId")
            .selectedIndex("2");
        cy.get("select")
            .id("selectedPeriodId")
            .selectedIndex("2");
    });
});

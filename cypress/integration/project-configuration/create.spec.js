import moment from "moment";

describe("Projects - Create", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("Project Configuration").click();
        cy.get("[data-test=list-action-bar]").click();
    });

    it("gets data from the user", () => {
        cy.contains("New project");

        // General Info step
        waitForStepChange("General info");

        cy.contains("Next").click();
        cy.contains("Name cannot be blank");
        cy.contains("Start Date cannot be blank");
        cy.contains("End Date cannot be blank");
        cy.contains("Award Number cannot be blank");
        cy.contains("Subsequent Lettering cannot be blank");

        cy.get("[data-field='name']").type("Cypress Project");
        cy.contains("Start Date").click({ force: true });
        clickDay(11);

        cy.contains("End Date").click({ force: true });
        clickDay(13);

        cy.get("[data-field='awardNumber']").type("12345");
        cy.get("[data-field='subsequentLettering']").type("Subsequent Lettering Value");

        cy.contains("Next").click();

        // Sectors & Funders

        waitForStepChange("Sectors & Project Funders");

        cy.contains("Next").click();
        cy.contains("Sectors: Select at least one item");
        cy.contains("Funders: Select at least one item");

        selectInMultiSelector("Sector1", 0);
        selectInMultiSelector("ACWME", 1);
        cy.contains("Next").click();

        // Organisation Units Step

        waitForStepChange("Organisation Units");
        cy.contains("Next").click();
        cy.contains("Organisation Units: Select at least one item");

        selectOrgUnit("Komboya");

        cy.contains("Next").click();

        // Data Elements

        waitForStepChange("Data Elements");
        cy.contains("Next").click();

        // Save step

        waitForStepChange("Summary and Save");
        cy.get("[data-test-current=true]").contains("Save");

        cy.contains("Name");
        cy.contains("Cypress Project");

        cy.contains("Period dates");
        const now = moment();
        const expectedDataStart = now.set("date", 11).format("LL");
        const expectedDataEnd = now.set("date", 13).format("LL");
        cy.contains(`${expectedDataStart} -> ${expectedDataEnd}`);

        cy.contains("Code");
        cy.contains("Description");

        cy.contains("Organisation Units");
        cy.contains("Komboya");

        cy.get("[data-wizard-contents] button")
            .contains("Save")
            .click();
    });
});

function selectOrgUnit(label) {
    cy.contains(label)
        .prev()
        .click();
    cy.contains(label)
        .should("have.css", "color")
        .and("not.equal", "rgba(0, 0, 0, 0.87)");
}

function clickDay(dayOfMonth) {
    cy.xpath(`//span[contains(text(), '${dayOfMonth}')]`).then(spans => {
        const span = spans[spans.length - 1];
        if (span && span.parentElement) {
            span.parentElement.click();
        }
    });

    cy.wait(100); // eslint-disable-line cypress/no-unnecessary-waiting
}

function selectInMultiSelector(label, index = 0) {
    const prefix = `[data-multi-selector]:nth-of-type(${index + 1})`;
    cy.get(prefix + " > div > div > div select:first").select(label);
    cy.get(prefix + " > div > div > div:nth-child(2)")
        .contains("→")
        .click();
}

function waitForStepChange(stepName) {
    cy.contains(stepName).should("have.class", "current-step");
}

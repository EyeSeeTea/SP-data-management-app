import moment from "moment";

describe("Projects - Create", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("Project Configuration").click();
        cy.get("[data-test=list-action-bar]").click();
    });
    it("gets data from the user and creates a project", () => {
        cy.contains("New project");

        // General Info step
        waitForStep("General info");

        cy.contains("Next").click();
        cy.contains("Name cannot be blank");
        cy.contains("Start Date cannot be blank");
        cy.contains("End Date cannot be blank");
        cy.contains("Award Number should be a number of 5 digits");
        cy.contains("Subsequent Lettering must have 2 characters");

        cy.get("[data-field='name']").type("Cypress Project");
        cy.get("[data-field='awardNumber']").type(Math.floor(10000 + Math.random() * 90000));
        cy.get("[data-field='subsequentLettering']").type("SL");

        cy.contains("Start Date").click({ force: true });
        clickDay(11);

        cy.contains("End Date").click({ force: true });
        clickDay(13);

        cy.contains("Next").click();

        // Sectors & Funders

        waitForStep("Sectors & Project Funders");

        cy.contains("Next").click();
        cy.contains("Select at least one item for Sectors");
        cy.contains("Select at least one item for Funders");

        selectInMultiSelector("sectors", "Agriculture");
        selectInMultiSelector("sectors", "Livelihoods");

        selectInMultiSelector("funders", "ACWME");

        cy.contains("Next").click();

        // Organisation Unit Step

        waitForStep("Organisation Unit");
        cy.contains("Next").click();
        cy.contains("One Organisation Unit should be selected");

        // expandOrgUnit("IQ");
        selectOrgUnit("Sierra Leona");

        cy.contains("Next").click();

        // Indicators selection

        waitForStep("Indicators Selection");
        cy.contains("# of agriculture groups receiving support for improved")
            .parent("td")
            .prev("td")
            .click();

        cy.contains("Livelihoods").click();
        cy.contains("# of HH-level storage equipment provided")
            .parent("td")
            .prev("td")
            .click();

        cy.contains("Next").click();

        // Save step

        waitForStep("Summary and Save");
        cy.get("[data-test-current=true]").contains("Save");

        cy.contains("Name");
        cy.contains("Cypress Project");

        cy.contains("Period dates");
        const now = moment();
        const expectedDataStart = now.set("date", 11).format("LL");
        const expectedDataEnd = now.set("date", 13).format("LL");
        cy.contains(`${expectedDataStart} -> ${expectedDataEnd}`);

        cy.contains("Description");

        cy.contains("Selected country");
        cy.contains("Sierra Leona");

        cy.contains("Sectors");
        cy.contains("# of agriculture groups receiving support for improved");
        cy.contains("# of HH-level storage equipment provided");

        cy.get("[data-wizard-contents] button")
            .contains("Save")
            .click();
    });
});

function selectOrgUnit(label) {
    cy.contains(label)
        .find("input")
        .click();
    cy.contains(label)
        .should("have.css", "color")
        .and("not.equal", "rgba(0, 0, 0, 0.87)");
}

function clickDay(dayOfMonth) {
    cy.xpath(`//p[contains(text(), '${dayOfMonth}')]`).then(spans => {
        const span = spans[spans.length - 1];
        if (span && span.parentElement) {
            span.parentElement.click();
        }
    });

    cy.wait(100); // eslint-disable-line cypress/no-unnecessary-waiting
}

function selectInMultiSelector(selectorName, label) {
    const prefix = `[data-test-selector='${selectorName}'] > div > div:last`;
    cy.get(prefix + " > div select:first").select(label);
    cy.contains("Selected")
        .next("button")
        .click();
}

function waitForStep(stepName) {
    cy.contains(stepName).should("have.class", "current-step");
}

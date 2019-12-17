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
        cy.contains("Subsequent Lettering must be a string of two letters only");

        cy.get("[data-field='name']").type("Cypress Project");
        cy.get("[data-field='awardNumber']").type(Math.floor(10000 + Math.random() * 90000));
        cy.get("[data-field='subsequentLettering']").type("SL");

        cy.contains("Start Date").click({ force: true });
        const projectYear = moment().year() + 1;
        selectDatePicker(projectYear, "Feb");

        cy.contains("End Date").click({ force: true });
        selectDatePicker(projectYear, "Jun");

        // Funders

        cy.contains("Funders");
        selectInMultiSelector("funders", "ACWME");

        cy.contains("Next").click();

        // Organisation Unit Step

        waitForStep("Organisation Unit");
        cy.contains("Next").click();
        cy.contains("One Organisation Unit should be selected");

        selectOrgUnit("Sierra Leona");
        cy.contains("Next").click();

        // Sectors and Location

        waitForStep("Sectors & Project Locations");

        cy.contains("Next").click();
        cy.contains("Select at least one item for Sectors");

        selectInMultiSelector("sectors", "Agriculture");
        selectInMultiSelector("sectors", "Livelihoods");

        cy.contains("Next").click();
        cy.contains("Select at least one item for Project Locations");

        selectInMultiSelector("locations", "Bahamas");

        cy.contains("Next").click();

        // Selection of Indicators

        waitForStep("Selection of Indicators");

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

        // Selection of MER Indicators

        waitForStep("Selection of MER Indicators");

        cy.contains("# of people trained on improved agriculture technologies/practices")
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
        cy.contains(`February 1, ${projectYear} -> June 30, ${projectYear}`);

        cy.contains("Description");

        cy.contains("Selected country");
        cy.contains("Sierra Leona");

        cy.contains("Sectors");
        cy.contains("# of agriculture groups receiving support for improved");
        cy.contains("# of people trained on improved agriculture technologies/practices [MER]");

        cy.contains("# of HH-level storage equipment provided [MER]");

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

function selectDatePicker(year, month) {
    const pickerSelector = "[class^=MuiPickersBasePicker-pickerView]";
    cy.get(pickerSelector)
        .contains(year.toString())
        .click();
    cy.get(pickerSelector)
        .contains(month)
        .click();
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

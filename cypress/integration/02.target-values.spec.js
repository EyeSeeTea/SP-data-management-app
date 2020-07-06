import DataEntryPage from "../support/pages/data-entry-page";

describe("Target Values", () => {
    beforeEach(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("00Cypress Project").trigger("contextmenu");
        cy.contains("Add Target Values").click();
    });

    it("can enter data values with new/recurring validations", () => {
        const entryPage = new DataEntryPage("data-entry");
        entryPage.selectInput("WS8XV4WWPE7", "HllvX50cXC0", 10);
        const dataElementId = "e6wdrrz9ZS6";
        const cocIds = {
            maleNew: "nwv02VfyQuz",
            maleRecurring: "rgEN46cGauU",
            femaleNew: "UU2P0YSJM8A",
            femaleRecurring: "xgT2W9JaXTq",
        };

        entryPage.selectTab("Livelihood");
        entryPage.selectInput(dataElementId, cocIds.maleNew, 1);
        entryPage.selectInput(dataElementId, cocIds.maleRecurring, 0);
        entryPage.selectInput(dataElementId, cocIds.femaleNew, 2);
        entryPage.selectInput(dataElementId, cocIds.femaleRecurring, 0);

        entryPage.selectMonth(1);

        entryPage.selectTab("Livelihood");
        entryPage.selectInput(dataElementId, cocIds.maleNew, 2);
        entryPage.selectInput(dataElementId, cocIds.maleRecurring, 1);
        entryPage.selectInput(dataElementId, cocIds.femaleNew, 3);
        entryPage.selectInput(dataElementId, cocIds.femaleRecurring, 0);

        entryPage.selectMonth(2);

        entryPage.selectTab("Livelihood");
        entryPage.selectInput(dataElementId, cocIds.maleNew, 3);
        entryPage.selectInput(dataElementId, cocIds.maleRecurring, 4);
        entryPage.hasValidationError("Recurring value (4) cannot be greater");
    });
});

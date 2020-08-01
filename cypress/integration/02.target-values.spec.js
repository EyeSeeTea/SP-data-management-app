import DataEntryPage from "../support/pages/data-entry-page";

describe("Target Values", () => {
    beforeEach(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("00Cypress Project").trigger("contextmenu");
        cy.contains("Add Target Values").click();
    });

    it.skip("can enter data values with new/returning validations", () => {
        const entryPage = new DataEntryPage("data-entry");
        entryPage.setInputValue("WS8XV4WWPE7", "GI9GyGCQwTf", 10);

        const dataElementMicrofinanceId = "imakJ22nlwc";
        const dataElementTopicsId = "e6wdrrz9ZS6";

        const cocIds = {
            newMale: "TpxiQHEumCA",
            newFemale: "Oq364hCb4KD",
            returningMale: "SW9iYI4GmW2",
            returningFemale: "ZbU1cop8Gzl",
        };
        const cocCovidIds = {
            newMale: "a0u8s8Ol11a",
            newFemale: "AwFU3V5kWRa",
            returningMale: "eUb9dPeFPQM",
            returningFemale: "X0G8okU3agJ",
        };

        entryPage
            .selectTab("Livelihood")

            .setInputValue(dataElementMicrofinanceId, cocIds.newMale, 1)
            .setInputValue(dataElementMicrofinanceId, cocIds.returningMale, 5)
            .setInputValue(dataElementMicrofinanceId, cocIds.newFemale, 2)
            .setInputValue(dataElementMicrofinanceId, cocIds.returningFemale, 3)

            .setInputValue(dataElementTopicsId, cocCovidIds.newMale, 1)
            .setInputValue(dataElementTopicsId, cocCovidIds.returningMale, 5)
            .setInputValue(dataElementTopicsId, cocCovidIds.newFemale, 2)
            .setInputValue(dataElementTopicsId, cocCovidIds.returningFemale, 3);

        entryPage.selectMonth(1);

        entryPage
            .selectTab("Livelihood")

            .setInputValue(dataElementMicrofinanceId, cocIds.newMale, 2)
            .setInputValue(dataElementMicrofinanceId, cocIds.returningMale, 1)
            .setInputValue(dataElementMicrofinanceId, cocIds.newFemale, 3)
            .setInputValue(dataElementMicrofinanceId, cocIds.returningFemale, 0)

            .setInputValue(dataElementTopicsId, cocCovidIds.newMale, 2)
            .setInputValue(dataElementTopicsId, cocCovidIds.returningMale, 1)
            .setInputValue(dataElementTopicsId, cocCovidIds.newFemale, 3)
            .setInputValue(dataElementTopicsId, cocCovidIds.returningFemale, 0);

        entryPage.selectMonth(2);

        entryPage
            .selectTab("Livelihood")
            .setInputValue(dataElementMicrofinanceId, cocIds.newMale, 3)
            .setInputValue(dataElementMicrofinanceId, cocIds.returningMale, 9, {
                validationError:
                    "Returning value (9) cannot be greater than the sum of initial returning + new values for past periods: July 2020 [1] + July 2020 [5] + August 2020 [2] = 8",
            })

            .setInputValue(dataElementTopicsId, cocCovidIds.newMale, 3)
            .setInputValue(dataElementTopicsId, cocCovidIds.returningMale, 9, {
                validationError:
                    "Returning value (9) cannot be greater than the sum of initial returning + new values for past periods: July 2020 [1] + July 2020 [5] + August 2020 [2] = 8",
            });
    });
});

import IndicatorsPage from "../support/pages/indicators-page";
import { selectInMultiSelector } from "../support/utils";

describe("Projects - Indicators", () => {
    before(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("00Cypress Project").trigger("contextmenu");
        cy.contains("Edit").click();
    });

    it("selects indicators with dependencies", () => {
        cy.contains("Sectors").click();
        selectInMultiSelector("sectors", "Protection");
        selectInMultiSelector("sectors", "Food");
        selectInMultiSelector("sectors", "Nutrition");
        cy.contains("Next").click();

        // Set pageSize = 50
        cy.contains("20").click();
        cy.contains("50").click();

        new IndicatorsPage(cy)
            .selectSector("Agriculture")
            // De-select initial indicator
            .assertExactSelected(["B010200"])
            .unselect("B010200")
            .assertExactSelected([])

            // Select an unpaired benefit sub -> automatic selection of its global in series
            .select("B010201")
            .assertSelected(["B010201", "B010200"])

            // Select an paired benefit sub -> automatic selection of its global in series and their paired
            .select("B010301")
            .assertSelected(["B010301", "B010300", "P010401", "P010400"])

            // Select a cross-sectorial -> select its series in main sector
            .select("P020105")
            .assertSelected(["P020105"])

            // Finally check that only the expected indicators are selected
            .assertExactSelected([
                ...["B010201", "B010200", "B010301", "B010300", "P010401"],
                ...["P010400", "P020105"],
            ])

            .selectSector("Livelihood")
            // Check that only the initial indicator are selected. The previous selection
            // of Agriculture->P020105 should not have modified the indicators in this section
            .assertExactSelected(["P020100", "P020103", "P020100"])

            // Select a global
            .select("B020200")
            .assertExactSelected(["P020100", "P020103", "B020200", "P020300"])
            // Unselect the global, as it has no subs selected, it should be unselected
            .unselect("B020200")
            .assertExactSelected(["P020100", "P020103"])

            .selectSector("Agriculture")
            // A global with subs cannot be unselected
            .unselect("B010200")
            .expectSnackbar("Global data elements with selected subs cannot be unselected")

            .selectSector("Protection")
            .select("B100500")
            .assertExactSelected(["B100500", "P100600"])

            .selectSector("Nutrition")
            // Select a cross-sectorial indicator which has paired sub indicators in other sectors (Food)
            .select("B050102")
            .assertExactSelected(["B050102", "P050202"])

            .selectSector("Food")
            // Now check the same cross-sectorial indicator in the other sector
            .select("B050102")
            .assertExactSelected(["B050102", "P050202", "B050100", "P050200"]);

        // MER Indicators
        cy.contains("Selection of MER Indicators").click();
        new IndicatorsPage(cy)
            .selectSector("Agriculture")
            .assertVisible([
                ...["B010201", "B010200", "B010301", "B010300", "P010401"],
                ...["P010400", "P020105"],
            ])
            .selectSector("Livelihood")
            .assertVisible(["P020100"])
            .assertExactSelected(["P020100"]);

        // Check indicators info in summary step
        cy.contains("Summary and Save").click();

        // Agriculture
        cy.contains("B010201");
        cy.contains("B010200");
        cy.contains("B010301");
        cy.contains("B010300");
        cy.contains("P010401");
        cy.contains("P010400");
        cy.contains("P020105");

        // Livelihood
        cy.contains("P020100 [COVID-19] [MER]");
    });
});

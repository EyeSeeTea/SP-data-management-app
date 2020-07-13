import "cypress-iframe";
import moment from "moment";

export default class DataEntryPage {
    constructor(iframeDataCy) {
        cy.frameLoaded(`[data-cy="${iframeDataCy}"]`);
    }

    selectInput(dataElementId, cocId, value) {
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.iframe()
            .find(`#${dataElementId}-${cocId}-val`)
            .wait(200)
            .focus()
            .clear({ force: true })
            .clear({ force: true })
            .type(value, { force: true });

        cy.iframe()
            .find("#tabs")
            .click();

        return this;
    }

    selectTab(title) {
        cy.iframe()
            .find("#tabs")
            .contains(title)
            .click();

        return this;
    }

    selectMonth(offset) {
        const startDate = moment().add(offset, "months");
        const text = `${startDate.format("MMMM")} ${startDate.format("YYYY")}`;
        cy.get("[data-cy=month-selector]").click();
        cy.contains(text).click();

        return this;
    }

    hasValidationError(text) {
        cy.contains(text);
        return this;
    }
}

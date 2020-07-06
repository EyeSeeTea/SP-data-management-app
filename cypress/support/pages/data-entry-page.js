import "cypress-iframe";
import moment from "moment";

export default class DataEntryPage {
    constructor(iframeDataCy) {
        cy.frameLoaded(`[data-cy="${iframeDataCy}"]`);
    }

    selectInput(dataElementId, cocId, value) {
        cy.iframe()
            .find(`#${dataElementId}-${cocId}-val`)
            .focus()
            .clear()
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
        cy.iframe()
            .get("body")
            .should($body => expect($body.get(0).innerText).to.contain(text));

        return this;
    }
}

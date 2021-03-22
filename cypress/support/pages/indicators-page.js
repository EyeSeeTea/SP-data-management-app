import _ from "lodash";

export default class IndicatorsPage {
    selectSector(name) {
        cy.get("[data-test-sidebar]").contains(name).click();
        return this;
    }

    unselect(code) {
        this.clickSelected(code);
        return this;
    }

    select(code) {
        this.clickSelected(code);
        return this;
    }

    assertSelected(expectedCodes) {
        getCodes(
            selectedCodes => {
                expect(selectedCodes).to.include.members(expectedCodes);
            },
            { onlySelected: true }
        );

        return this;
    }

    assertVisible(expectedCodes) {
        getCodes(
            selectedCodes => {
                expect(selectedCodes).to.include.members(expectedCodes);
            },
            { onlySelected: false }
        );

        return this;
    }

    assertExactSelected(expectedCodes) {
        getCodes(
            selectedCodes => {
                expect(_.sortBy(_.uniq(expectedCodes))).to.deep.equal(_.sortBy(selectedCodes));
            },
            { onlySelected: true }
        );

        return this;
    }

    clickSelected(code) {
        cy.contains(code).parent("tr").children("td:first").click();

        return this;
    }

    expectSnackbar(text) {
        cy.get("#client-snackbar").contains(text);
        return this;
    }
}

function getCodes(cb, options) {
    const { onlySelected } = options;
    const extra = onlySelected ? ".Mui-selected" : "";
    cy.get(".MuiTableBody-root").then(() => {
        const codeFields = Cypress.$(`.MuiTableRow-root${extra} td:nth-child(3)`)
            .get()
            .map(x => x.innerText);
        const codes = _(codeFields)
            .flatMap(codeField => codeField.split("\n"))
            .map(code => code.trim())
            .value();
        cb(codes);
    });
}

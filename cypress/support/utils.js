export function selectOrgUnit(label) {
    cy.contains(label).find("input").click();
    cy.contains(label).should("have.css", "color").and("equal", "rgb(255, 165, 0)");
}

export function selectDatePicker(year, month) {
    const pickerSelector = "[class^=dm-MuiPickersBasePicker-pickerView]";
    cy.get(pickerSelector).contains(year.toString()).click();
    cy.get(pickerSelector).contains(month).click();
}

export function selectInMultiSelector(selectorName, label) {
    const prefix = `[data-test-selector='${selectorName}'] > div > div:last`;
    cy.get(prefix + " > div select:first").select(label);
    cy.contains("Selected").next("button").click();
}

export function runAndWaitForRequest(urlPattern, action) {
    cy.server().route("GET", urlPattern).as(urlPattern);

    action();

    cy.wait("@" + urlPattern);
}

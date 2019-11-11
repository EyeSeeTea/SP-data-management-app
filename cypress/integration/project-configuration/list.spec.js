import _ from "lodash";

//try to import from app, but it doesn't work
const config = {
    currentUser: {
        userRoles: ["Manager"],
    },
    userRoles: {
        app: ["Manager", "Superadmin", "Encoder"],
        feedback: ["Feedback", "Manager"],
        reportingAnalyst: ["Configurator"],
        superUser: ["Superuser"],
        encode: ["Encode"],
        analyser: ["Analyser"],
    },
};

const appRole = _.isEqual(
    _.intersection(config.currentUser.userRoles, config.userRoles.app),
    config.currentUser.userRoles
);
const feedbackRole = _.isEqual(
    _.intersection(config.currentUser.userRoles, config.userRoles.feedback),
    config.currentUser.userRoles
);
const reportingAnalystRole = _.isEqual(
    _.intersection(config.currentUser.userRoles, config.userRoles.reportingAnalyst),
    config.currentUser.userRoles
);
const superUserRole = _.isEqual(
    _.intersection(config.currentUser.userRoles, config.userRoles.superUser),
    config.currentUser.userRoles
);
const encodeRole = _.isEqual(
    _.intersection(config.currentUser.userRoles, config.userRoles.encode),
    config.currentUser.userRoles
);
const analyserRole = _.isEqual(
    _.intersection(config.currentUser.userRoles, config.userRoles.analyser),
    config.currentUser.userRoles
);

describe("Project Configuration - List page", () => {
    beforeEach(() => {
        cy.login("admin");
        cy.loadPage();
        cy.contains("Project Configuration").click();
    });

    it("shows list of user projects", () => {
        cy.get(".data-table__rows > :nth-child(3) > :nth-child(4) span").should("not.be.empty");
    });

    it("opens details window when mouse clicked", () => {
        cy.get(".data-table__rows > :nth-child(3) > :nth-child(4) span").click();
        cy.contains("API link");
        cy.contains("Id");
    });

    if (appRole) {
        it("opens app role context window when right button mouse is clicked", () => {
            cy.get(".data-table__rows > :nth-child(3) > :nth-child(4) span")
                .first()
                .trigger("contextmenu");

            cy.contains("Details");
            cy.contains("Go to Data Entry");
            cy.contains("Go to Dashboard");
            cy.contains("Add Target Values");
            cy.contains("Download Data");
            cy.contains("Generate / Configure MER");
            cy.contains("Edit");
            cy.contains("Delete");
        });
    } else if (feedbackRole) {
        it("opens feedback role context window when right button mouse is clicked", () => {
            cy.get(".data-table__rows > :nth-child(3) > :nth-child(4) span")
                .first()
                .trigger("contextmenu");

            cy.contains("Details");
            cy.contains("Go to Data Entry");
            cy.contains("Go to Dashboard");
            cy.contains("Add Target Values");
            cy.contains("Download Data");
            cy.contains("Generate / Configure MER");
            cy.contains("Edit");
            cy.contains("Delete");
        });
    } else if (analyserRole) {
        it("opens analyser role context window when right button mouse is clicked", () => {
            cy.get(".data-table__rows > :nth-child(3) > :nth-child(4) span")
                .first()
                .trigger("contextmenu");

            cy.contains("Go to Dashboard");
        });
    } else if (encodeRole) {
        it("opens encode role context window when right button mouse is clicked", () => {
            cy.get(".data-table__rows > :nth-child(3) > :nth-child(4) span")
                .first()
                .trigger("contextmenu");

            cy.contains("Go to Data Entry");
        });
    } else if (superUserRole) {
        it("opens super user context window when right button mouse is clicked", () => {
            cy.get(".data-table__rows > :nth-child(3) > :nth-child(4) span")
                .first()
                .trigger("contextmenu");

            cy.contains("Details");
            cy.contains("Download Data");
            cy.contains("Edit");
            cy.contains("Delete");
        });
    } else if (reportingAnalystRole) {
        it("opens reporting analyst context window when right button mouse is clicked", () => {
            cy.get(".data-table__rows > :nth-child(3) > :nth-child(4) span")
                .first()
                .trigger("contextmenu");

            cy.contains("Add Target Values");
            cy.contains("Generate / Configure MER");
            cy.contains("Edit");
            cy.contains("Delete");
        });
    }

    it("shows list of user dataset sorted alphabetically", () => {
        cy.get(".data-table__rows > :nth-child(1) > :nth-child(2) span").then(text1 => {
            cy.get(".data-table__rows > :nth-child(2) > :nth-child(2) span").then(text2 => {
                assert.isTrue(text1.text() < text2.text());
            });
        });
    });

    it("shows list of user dataset sorted alphabetically by name desc", () => {
        cy.contains("Name").click();
        cy.get("[data-test='displayName-sorting-desc']");

        cy.get(".data-table__rows > * > :nth-child(2) span").then(spans$ => {
            const names = spans$.get().map(x => x.innerText);
            const sortedNames = _(names)
                .orderBy(name => name.toLowerCase())
                .reverse()
                .value();
            console.log({ names, sortedNames });
            assert.isTrue(_.isEqual(names, sortedNames));
        });
    });

    it("can filter datasets by name", () => {
        cy.get("[data-test='search'] input")
            .clear()
            .type("cypress test");

        cy.contains("No results found");
    });
    if ((appRole, feedbackRole, analyserRole)) {
        it("will navegate to dashboard from the actions menu", () => {
            cy.get(".data-table__rows > :nth-child(1) button").click();
            cy.get("span[role=menuitem]")
                .contains("Go to Dashboard")
                .click();

            cy.get("h5").contains("Dashboard");
            cy.url().should("include", "/dashboard");
        });
    } else if ((appRole, encodeRole)) {
        it("will navegate to data-entry from the actions menu", () => {
            cy.get(".data-table__rows > :nth-child(1) button").click();
            cy.get("span[role=menuitem]")
                .contains("Go to Data Entry")
                .click();

            cy.get("h5").contains("Data Entry");
            cy.url().should("include", "/data-entry/");
        });
    }
});

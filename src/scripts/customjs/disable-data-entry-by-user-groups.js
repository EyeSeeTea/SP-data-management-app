/*
    Script to be used in the "Custom JS/CSS" App.

    Hide the main page of Data Entry App if the current user belongs to a blacklisted user group.
*/

const message = "You should use the data management app to entry or analyse data";

const userGroupsBlacklistedPatterns = [
    // regular expressions, name or codes.
    "Data Management Admin",
    "Data Management Notification",
    "Data Management User",
    "ADMIN_COUNTRY_",
];

async function disablePageForNotAllowedUsers() {
    if (await currentUserBelongsToSomeBlacklistedUserGroup()) {
        disablePage();
    }
}

disablePageForNotAllowedUsers();

/* Implementation */

function log(...args) {
    console.debug(`[Custom JS/CSS]`, ...args);
}

function disablePage() {
    let interval;

    function checkElement() {
        var mainPageDiv = document.querySelector("#mainPage");

        if (mainPageDiv) {
            log(`Element found, disable page`, mainPageDiv);
            mainPageDiv.innerHTML = `<h1>${message}</h1>`;
            if (interval) clearInterval(interval);
        }
    }

    interval = setInterval(checkElement, 100);
}

function getBaseUrl() {
    const path = new URL(window.location.href).pathname;
    const parts = path.split("/");
    const baseName = parts.slice(0, parts.length - 2).join("/");
    log(`baseName=${baseName}`);
    return baseName;
}

async function currentUserBelongsToSomeBlacklistedUserGroup() {
    const baseName = getBaseUrl();
    const meUrl = `${baseName}/api/me.json?fields=userGroups[id,name,code]`;
    const res = await fetch(meUrl).then(res => res.json());
    log("Response", res);

    return res.userGroups.some(userGroup => userGroupMatches(userGroup));
}

function userGroupMatches(userGroup) {
    return userGroupsBlacklistedPatterns.some(pattern => {
        return userGroup.name.match(pattern) || userGroup.code.match(pattern);
    });
}

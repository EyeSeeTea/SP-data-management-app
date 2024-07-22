/*
    Script to be used in the "Custom JS/CSS" App.

    Hide the main page of Data Entry App if the current user
    belongs only to some specific list user group but allow to
    use it as iframe in the Data Management App.
*/

const message = "You should use the data management app to entry or analyse data";

const userGroupsForbiddenFromUsingStandardDataEntryApp = [
    // Names or codes (regular expression)
    "Data Management Admin",
    "Data Management Notification",
    "Data Management User",
    "ADMIN_COUNTRY_",
];

async function disablePageForNotAllowedUsers() {
    if (isStandardDataEntryApp() && !(await currentUserCanUseStandardDataEntryApp())) {
        disablePage();
    }
}

disablePageForNotAllowedUsers();

/* Implementation */

function log(...args) {
    console.debug(`[Custom JS/CSS]`, ...args);
}

function isIframe() {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

function isStandardDataEntryApp() {
    return !isIframe();
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
    log(`baseName=${JSON.stringify(baseName)}`);
    return baseName;
}

async function currentUserCanUseStandardDataEntryApp() {
    const baseName = getBaseUrl();
    const meUrl = `${baseName}/api/me.json?fields=userGroups[id,name,code]`;
    const res = await fetch(meUrl).then(res => res.json());
    log("Response", res);
    log("currentUser:userGroups", res.userGroups.map(ug => `${ug.name}[${ug.code}]`).join(", "));

    return res.userGroups.some(userGroup => !userGroupMatches(userGroup));
}

function userGroupMatches(userGroup) {
    return userGroupsForbiddenFromUsingStandardDataEntryApp.some(pattern => {
        return userGroup.name.match(pattern) || userGroup.code.match(pattern);
    });
}

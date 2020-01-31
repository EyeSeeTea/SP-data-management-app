import _ from "lodash";
import fs from "fs";
import { D2ApiDefault, D2User, PartialModel } from "d2-api";
import { getUid } from "../src/utils/dhis2";

const filterOrgUnits = ["Philippines", "Bahamas"];

async function createUsers(usersPath: string, baseUrl: string) {
    const api = new D2ApiDefault({ baseUrl });
    const usersInfo = getUsersInfo(usersPath);
    const orgUnits = await getOrgUnits(api);
    const userRoles = await getRoles(api);
    const users = getUsers(usersInfo, userRoles, orgUnits);
    console.log(`POST ${users.length} users`);
    const response = await api.metadata.post({ users }).getData();
    console.log("Response", JSON.stringify(response.typeReports, null, 2));
}

if (require.main === module) {
    const [usersPath, baseUrl] = process.argv.slice(2);
    if (!usersPath || !baseUrl) {
        console.error("Usage: config.ts USERS_TEXT_FILE DHIS2_URL");
        process.exit(1);
    } else {
        createUsers(usersPath, baseUrl);
    }
}

/* Helpers */

function getUsers(
    usersInfo: { name: string; email: string; roleName: string }[],
    userRoles: ({ name: string; id: string })[],
    orgUnits: ({ id: string; name: string })[]
) {
    const feedbackRole = userRoles.find(ur => ur.name === "PM Feedback");
    if (!feedbackRole) throw new Error("Feedback role not found");

    const organisationUnits = orgUnits
        .filter(ou => filterOrgUnits && filterOrgUnits.includes(ou.name))
        .map(ou => ({ id: ou.id }));

    console.log(`User org units: ${organisationUnits.map(ou => ou.id).join(", ")}`);

    const users = usersInfo.map(({ name, email, roleName }) => {
        const userRole = userRoles.find(ur => ur.name.includes(roleName));
        const [firstName, surname] = name.split(" ", 2);
        if (!userRole) console.error(`User role not found: ${roleName}`);
        const username = email.split("@")[0];
        const roles = _.compact([userRole ? { id: userRole.id } : null, { id: feedbackRole.id }]);
        const user: PartialModel<D2User> = {
            id: getUid("user", username),
            firstName,
            surname,
            email,
            organisationUnits,
            dataViewOrganisationUnits: organisationUnits,
            teiSearchOrganisationUnits: organisationUnits,
            userCredentials: {
                id: getUid("userCredentials", username),
                username,
                password: username + "P123$",
                userRoles: roles,
            },
        };
        return user;
    });

    return _.compact(users);
}

async function getRoles(api: D2ApiDefault) {
    const userRoles = await api.models.userRoles
        .get({ fields: { id: true, name: true } })
        .getData()
        .then(({ objects }) => objects);
    console.log(`User roles: ${userRoles.map(ur => ur.name).join(", ")}`);
    return userRoles;
}

async function getOrgUnits(api: D2ApiDefault) {
    return await api.metadata
        .get({ organisationUnits: { fields: { id: true, name: true } } })
        .getData()
        .then(({ organisationUnits }) => organisationUnits);
}

function getUsersInfo(usersPath: string) {
    // File contains name/email/roleName, one field per line, so we need to group (chunk) them
    const usersContents = fs.readFileSync(usersPath, "utf8");
    const lines = usersContents.trim().split(/\n/);
    return _(lines)
        .map(line => line.trim())
        .chunk(3)
        .map(([name, email, roleName]) => ({ name, email, roleName }))
        .value();
}

import _ from "lodash";
import md5 from "md5";
import { D2Api } from "d2-api";

export function getIdFromOrgUnit<OrgUnit extends { path: string }>(orgUnit: OrgUnit) {
    const id = _.last(orgUnit.path.split("/"));
    if (id) {
        return id;
    } else {
        throw new Error(`Invalid path: ${orgUnit.path}`);
    }
}

export function getDataStore(api: D2Api) {
    return api.dataStore("project-monitoring-app");
}

// DHIS2 UID :: /^[a-zA-Z][a-zA-Z0-9]{10}$/
const asciiLetters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const asciiNumbers = "0123456789";
const asciiLettersAndNumbers = asciiLetters + asciiNumbers;
const uidStructure = [asciiLetters, ..._.range(0, 10).map(() => asciiLettersAndNumbers)];
const maxHashValue = _(uidStructure)
    .map(cs => cs.length)
    .reduce((acc, n) => acc * n, 1);

/* Return pseudo-random UID from seed prefix/key */
export function getUid(prefix: string, key: string): string {
    const seed = prefix + key;
    const md5hash = md5(seed);
    const nHashChars = Math.ceil(Math.log(maxHashValue) / Math.log(16));
    const hashInteger = parseInt(md5hash.slice(0, nHashChars), 16);
    const result = uidStructure.reduce(
        (acc, chars) => {
            const { n, uid } = acc;
            const nChars = chars.length;
            const quotient = Math.floor(n / nChars);
            const remainder = n % nChars;
            const uidChar = chars[remainder];
            return { n: quotient, uid: uid + uidChar };
        },
        { n: hashInteger, uid: "" }
    );

    return result.uid;
}

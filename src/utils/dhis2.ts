import _ from "lodash";
import md5 from "md5";

import { D2Api, Ref, Id, MetadataPayload, PostOptions } from "../types/d2-api";
import { runPromises } from "./promises";

export function getIds<T extends Ref>(objs: T[]): Id[] {
    return objs.map(obj => obj.id);
}

export function getRef<T extends Ref>(obj: T): Ref {
    return { id: obj.id };
}

export function haveSameRefs<T extends Ref>(objs1: T[], objs2: T[]): boolean {
    const get = <T extends Ref>(objs: T[]) => _.sortBy(objs.map(o => o.id)).join("-");
    return objs1.length === objs2.length && get(objs1) === get(objs2);
}

export function getRefs<T extends Ref>(objs: T[]): Ref[] {
    return objs.map(obj => ({ id: obj.id }));
}

export function getIOrgUnitLevel<OrgUnit extends { path: string }>(orgUnit: OrgUnit): number {
    return (orgUnit.path.match(/\//g) || []).length;
}

export function getIdFromOrgUnit<OrgUnit extends { path: string }>(orgUnit: OrgUnit) {
    const id = _.last(orgUnit.path.split("/"));
    if (id) {
        return id;
    } else {
        throw new Error(`Invalid path: ${orgUnit.path}`);
    }
}

export async function postMetadataRequests(
    api: D2Api,
    requests: Array<Partial<MetadataPayload>>,
    options: Partial<PostOptions>
): Promise<boolean> {
    const responses = await runPromises(
        requests.map(request => () => api.metadata.post(request, options).getData()),
        { concurrency: 1 }
    );

    return _.every(responses, response => response.status === "OK");
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

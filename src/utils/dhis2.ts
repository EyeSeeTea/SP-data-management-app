import _ from "lodash";
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

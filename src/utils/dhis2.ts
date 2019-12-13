import _ from "lodash";

export function getIdFromOrgUnit<OrgUnit extends { path: string }>(orgUnit: OrgUnit) {
    const id = _.last(orgUnit.path.split("/"));
    if (id) {
        return id;
    } else {
        throw new Error(`Invalid path: ${orgUnit.path}`);
    }
}

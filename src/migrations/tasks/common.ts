import _ from "lodash";
import { D2Api, D2Payload, Id } from "../../types/d2-api";
import { Debug } from "../types";
import { Config } from "../../models/Config";
import ProjectsList from "../../models/ProjectsList";

export async function getProjectIds(api: D2Api, config: Config, debug: Debug): Promise<Id[]> {
    debug("Get projects");

    const { objects: projectItems } = await new ProjectsList(api, config).get(
        {},
        { field: "id", order: "asc" },
        { page: 1, pageSize: 100000 }
    );

    return _(projectItems)
        .orderBy([project => project.parent.displayName, project => project.displayName])
        .map(project => project.id)
        .value();
}

export function error(msg: string) {
    throw Error(msg);
}

export async function post<Payload extends D2Payload>(api: D2Api, debug: Debug, payload: Payload) {
    const res = await api.metadata.post(payload).getData();
    if (res.status !== "OK") {
        debug(JSON.stringify(res));
        throw Error("Error on post");
    }
    console.debug(res);
    return res;
}

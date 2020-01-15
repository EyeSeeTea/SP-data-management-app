import { RequiredProps } from "./../../types/utils";
import { ProjectData } from "./../Project";
import { D2Api } from "d2-api";
import _ from "lodash";
import moment from "moment";
import Project from "../Project";
import { Config } from "../Config";

import configJson from "./config.json";

export const config = (configJson as unknown) as Config;

export const projectData = {
    id: "WGC0DJ0YSis",
    name: "MyProject",
    startDate: moment("2018-10-01"),
    endDate: moment("2019-03-01"),
    parentOrgUnit: {
        path: "/J0hschZVMBt/eu2XF73JOzl",
        id: "eu2XF73JOzl",
        displayName: "Bahamas",
    },
    orgUnit: {
        path: "/J0hschZVMBt/eu2XF73JOzl/WGC0DJ0YSis",
        id: "WGC0DJ0YSis",
        displayName: "MyProject",
    },
    funders: config.funders.slice(0, 2),
    locations: config.locations.filter(location =>
        _.isEqual(location.countries[0], { id: "eu2XF73JOzl" })
    ),
    awardNumber: "12345",
    subsequentLettering: "en",
    sectors: config.sectors.slice(0, 2),
};

type R1 = Partial<RequiredProps<ProjectData>>;

export function getProject<K extends keyof ProjectData>(
    api: D2Api,
    partialProjectData?: Pick<ProjectData, K>
): Project {
    return Project.create(api, config)
        .setObj(Object.assign({}, projectData, partialProjectData || {}))
        .updateDataElementsSelection(["WS8XV4WWPE7", "ik0ICagvIjm", "We61YNYyOX0"])
        .project.updateDataElementsMERSelection(["WS8XV4WWPE7", "We61YNYyOX0"]);
}

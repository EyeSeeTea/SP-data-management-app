import _ from "lodash";
import MockAdapter from "axios-mock-adapter";
import { metadata } from "./metadata";
import { Config, getConfig } from "./../Config";
import { D2Api, getMockApi } from "d2-api";

const user = {
    id: "M5zQapPyTZI",
    displayName: "Admin superuser",
    userCredentials: {
        userRoles: [{ name: "PM Superuser" }],
    },
    organisationUnits: [{ id: "J0hschZVMBt", displayName: "IHQ" }],
};

export function getMockConfig(api: D2Api, mock: MockAdapter): Promise<Config> {
    mock.reset();
    mock.onGet("/metadata", {
        params: {
            "attributes:fields": "code,id",
            "attributes:filter": [
                "code:in:[PM_PAIRED_DE,PM_CREATED_BY_PROJECT_MONITORING,PM_ORGUNIT_PROJECT_ID,PM_PROJECT_DASHBOARD_ID,PM_COUNTING_METHOD]",
            ],
            "categories:fields": "categoryOptions[code,id],code,id",
            "categories:filter": ["code:in:[ACTUAL_TARGET,GENDER,NEW_RECURRING]"],
            "categoryCombos:fields": "categoryOptionCombos[displayName,id],code,id",
            "categoryCombos:filter": ["code:in:[ACTUAL_TARGET,GENDER_NEW_RECURRING,default]"],
            "categoryOptions:fields": "code,id",
            "categoryOptions:filter": ["code:in:[TARGET,ACTUAL,NEW,RECURRING,MALE,FEMALE]"],
            "legendSets:fields": "code,id",
            "legendSets:filter": ["code:in:[ACTUAL_TARGET_ACHIEVED]"],
            "dataElements:fields":
                "attributeValues[attribute[code,id],value],categoryCombo[id],code,description,displayName,id",
            "dataElementGroupSets:fields":
                "code,dataElementGroups[code,dataElements[id],displayName,id]",
            "dataElementGroupSets:filter": ["code:in:[SECTOR,SERIES,TYPE_1,TYPE_2,EXTERNAL]"],
            "indicators:fields": "code,id",
            "organisationUnitGroupSets:fields":
                "code,organisationUnitGroups[displayName,id,organisationUnits[id,level]]",
            "organisationUnitGroupSets:filter": ["code:in:[FUNDER,LOCATION]"],
        },
    }).replyOnce(200, metadata);

    mock.onGet("/me", {
        params: {
            fields:
                "displayName,id,organisationUnits[displayName,id],userCredentials[userRoles[name]]",
        },
    }).replyOnce(200, user);

    return getConfig(api);
}

const { api, mock } = getMockApi();
let config: Config;

describe("Config", () => {
    beforeAll(async () => {
        config = await getMockConfig(api, mock);
    });

    describe("getConfig", () => {
        it("returns config object", () => {
            const configKeys = _(config)
                .keys()
                .sortBy()
                .value();

            expect(configKeys).toEqual([
                "attributes",
                "base",
                "categories",
                "categoryCombos",
                "categoryOptions",
                "currentUser",
                "dataElements",
                "funders",
                "indicators",
                "legendSets",
                "locations",
                "sectors",
            ]);
        });
    });
});

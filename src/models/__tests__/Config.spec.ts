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
        "attributes:fields": "code,id",
        "attributes:filter": ["code:eq:PM_PAIRED_DE"],
        "dataElementGroupSets:fields":
            "code,dataElementGroups[code,dataElements[attributeValues[attribute[id],value]," +
            "categoryCombo[id],code,displayName,id],displayName,id]",
        "dataElementGroupSets:filter": ["code:eq:SECTOR"],
        "dataElementGroups:fields": "code,dataElements[id]",
        "dataElementGroups:filter": [],
    }).replyOnce(200, metadata);

    mock.onGet("/me", {
        fields: "displayName,id,organisationUnits[displayName,id],userCredentials[userRoles[name]]",
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
                "currentUser",
                "dataElements",
                "funders",
                "indicators",
                "sectors",
            ]);
        });
    });
});

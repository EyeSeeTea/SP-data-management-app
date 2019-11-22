import _ from "lodash";
import { D2Api, Id, MetadataPick } from "d2-api";
import DataElementsSet, { DataElement } from "./dataElementsSet";
import { GetItemType } from "../types/utils";

const yes = true as const;

const baseConfig = {
    userRoles: {
        feedback: ["PM Feedback"],
        reportingAnalyst: ["PM Reporting Analyst"],
        superUser: ["PM Superuser"],
        encode: ["PM Encoder"],
        analyser: ["PM Analyser"],
    },
    dataElementGroupSets: {
        sector: "SECTOR",
        series: "SERIES",
        type1: "TYPE_1",
        type2: "TYPE_2",
    },
    attributes: {
        pairedDataElement: "PM_PAIRED_DE",
        createdByApp: "PM_CREATED_BY_PROJECT_MONITORING",
        orgUnitProject: "PM_ORGUNIT_PROJECT_ID",
        projectDashboard: "PM_PROJECT_DASHBOARD_ID",
    },
    dataElementGroups: {
        global: "GLOBAL",
        sub: "SUB",
        people: "PEOPLE",
        benefit: "BENEFIT",
    },
};

const metadataParams = {
    attributes: {
        fields: {
            id: yes,
            code: yes,
        },
    },
    dataElementGroupSets: {
        fields: {
            code: yes,
            dataElementGroups: {
                id: yes,
                displayName: yes,
                code: yes,
                dataElements: {
                    id: yes,
                    code: yes,
                    attributeValues: { attribute: { id: yes }, value: yes },
                    displayName: yes,
                    categoryCombo: { id: yes },
                },
            },
        },
        filter: {
            code: { in: _.values(baseConfig.dataElementGroupSets) },
        },
    },
};

type Metadata = MetadataPick<typeof metadataParams>;
export type BaseConfig = typeof baseConfig;

export type CurrentUser = {
    id: Id;
    userRoles: Array<{ name: string }>;
    organisationUnits: OrganisationUnit[];
};

export interface OrganisationUnit {
    id: Id;
    displayName: string;
}

export type DataElementGroupSet = GetItemType<Metadata["dataElementGroupSets"]>;

export type Attribute = GetItemType<Metadata["attributes"]>;

export type Sector = {
    id: Id;
    displayName: string;
};

export type Config = {
    base: typeof baseConfig;
    currentUser: CurrentUser;
    dataElements: DataElement[];
    sectors: Sector[];
    attributes: Attribute[];
};

class ConfigLoader {
    constructor(public api: D2Api) {}

    async get(): Promise<Config> {
        const metadata: Metadata = await this.api.metadata.get(metadataParams).getData();
        const dataElementsMetadata = await this.getDataElementsMetadata(metadata);
        const currentUser = await this.getCurrentUser();

        const config = {
            base: baseConfig,
            currentUser: {
                id: currentUser.id,
                userRoles: currentUser.userCredentials.userRoles,
                organisationUnits: currentUser.organisationUnits,
            },
            attributes: metadata.attributes,
            ...dataElementsMetadata,
        };

        return config;
    }

    async getCurrentUser() {
        return this.api.currrentUser
            .get({
                fields: {
                    id: true,
                    displayName: true,
                    userCredentials: { userRoles: { name: true } },
                    organisationUnits: { id: true, displayName: true },
                },
            })
            .getData();
    }

    async getDataElementsMetadata(metadata: Metadata) {
        const dataElements = await DataElementsSet.getDataElements(baseConfig, metadata);
        const sectors = _(metadata.dataElementGroupSets)
            .keyBy(degSet => degSet.code)
            .getOrFail(baseConfig.dataElementGroupSets.sector).dataElementGroups;
        return { sectors, dataElements };
    }
}

export async function getConfig(api: D2Api): Promise<Config> {
    return new ConfigLoader(api).get();
}

import _ from "lodash";
import { D2Api, Id, MetadataPick } from "d2-api";
import DataElementsSet, { DataElement } from "./dataElementsSet";
import { GetItemType } from "../types/utils";
import "../utils/lodash-mixins";

const yes = true as const;

const baseConfig = {
    userRoles: {
        feedback: ["PM Feedback"],
        dataReviewer: ["Data Reviewer"],
        dataViewer: ["Data Viewer"],
        admin: ["PM Admin"],
        dataEntry: ["Data Entry"],
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
    categoryCombos: {
        targetActual: "ACTUAL_TARGET",
    },
    dataElementGroups: {
        global: "GLOBAL",
        sub: "SUB",
        people: "PEOPLE",
        benefit: "BENEFIT",
    },
    organitionUnitGroupSets: {
        funder: "FUNDER",
    },
};

const metadataParams = {
    attributes: {
        fields: {
            id: yes,
            code: yes,
        },
    },
    categoryCombos: {
        fields: { id: yes, code: yes },
        filter: { code: { in: _.values(baseConfig.categoryCombos) } },
    },
    dataElements: {
        fields: {
            id: yes,
            code: yes,
            description: yes,
            attributeValues: { attribute: { id: yes }, value: yes },
            displayName: yes,
            categoryCombo: { id: yes },
        },
    },
    dataElementGroupSets: {
        fields: {
            code: yes,
            dataElementGroups: {
                id: yes,
                displayName: yes,
                code: yes,
                dataElements: { id: yes },
            },
        },
        filter: {
            code: { in: _.values(baseConfig.dataElementGroupSets) },
        },
    },
    organisationUnitGroupSets: {
        fields: {
            code: yes,
            organisationUnitGroups: {
                id: yes,
                displayName: yes,
            },
        },
        filter: {
            code: { eq: baseConfig.organitionUnitGroupSets.funder },
        },
    },
};

export type Metadata = MetadataPick<typeof metadataParams>;
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

type NamedObject = { id: Id; displayName: string };
type CodedObject = { id: Id; code: string };

export type Sector = NamedObject;
export type Funder = NamedObject;

export type Config = {
    base: typeof baseConfig;
    currentUser: CurrentUser;
    dataElements: DataElement[];
    categoryCombos: Record<keyof BaseConfig["categoryCombos"], CodedObject>;
    sectors: Sector[];
    funders: Funder[];
    attributes: Attribute[];
};

class ConfigLoader {
    constructor(public api: D2Api) {}

    async get(): Promise<Config> {
        const metadata: Metadata = await this.api.metadata.get(metadataParams).getData();
        const dataElementsMetadata = await this.getDataElementsMetadata(metadata);
        const d2CurrentUser = await this.getCurrentUser();

        const funders = _(metadata.organisationUnitGroupSets)
            .keyBy(ougSet => ougSet.code)
            .getOrFail(baseConfig.organitionUnitGroupSets.funder).organisationUnitGroups;

        const currentUser = {
            id: d2CurrentUser.id,
            userRoles: d2CurrentUser.userCredentials.userRoles,
            organisationUnits: d2CurrentUser.organisationUnits,
        };

        const config = {
            base: baseConfig,
            currentUser: currentUser,
            attributes: metadata.attributes,
            ...dataElementsMetadata,
            funders: _.sortBy(funders, funder => funder.displayName),
            categoryCombos: indexObjects(metadata, "categoryCombos"),
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

type IndexableKeys = "categoryCombos";
type Indexed<Key extends IndexableKeys> = Record<keyof BaseConfig[Key], CodedObject>;

function indexObjects<Key extends IndexableKeys>(metadata: Metadata, key: Key): Indexed<Key> {
    const keyByCodes = _.invert(baseConfig[key]) as Record<string, keyof BaseConfig[Key]>;
    const objects = metadata[key];
    return _.keyBy(objects, obj => _(keyByCodes).getOrFail(obj.code)) as Indexed<Key>;
}

export async function getConfig(api: D2Api): Promise<Config> {
    return new ConfigLoader(api).get();
}

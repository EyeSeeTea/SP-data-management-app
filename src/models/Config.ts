import _ from "lodash";
import { D2ApiDefault, D2Api, Id, MetadataPick } from "d2-api";
import fs from "fs";
import path from "path";
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
    categories: {
        targetActual: "ACTUAL_TARGET",
        gender: "GENDER",
        newRecurring: "NEW_RECURRING",
    },
    categoryCombos: {
        targetActual: "ACTUAL_TARGET",
    },
    categoryOptions: {
        target: "TARGET",
        actual: "ACTUAL",
        new: "NEW",
        recurring: "RECURRING",
    },
    dataElementGroups: {
        global: "GLOBAL",
        sub: "SUB",
        people: "PEOPLE",
        benefit: "BENEFIT",
    },
    legendSets: {
        achieved: "ACTUAL_TARGET_ACHIEVED",
    },
    organitionUnitGroupSets: {
        funder: "FUNDER",
    },
    indicators: {
        actualTargetPrefix: "ACTUAL_TARGET_",
    },
};

function getParamsForIndexables(indexedCodes: _.Dictionary<string>) {
    return {
        fields: { id: yes, code: yes },
        filter: { code: { in: _.values(indexedCodes) } },
    };
}

const metadataParams = {
    attributes: getParamsForIndexables(baseConfig.attributes),
    categories: {
        fields: { id: yes, code: yes, categoryOptions: { id: yes, code: yes } },
        filter: { code: { in: _.values(baseConfig.categories) } },
    },
    categoryCombos: getParamsForIndexables(baseConfig.categoryCombos),
    categoryOptions: getParamsForIndexables(baseConfig.categoryOptions),
    legendSets: getParamsForIndexables(baseConfig.legendSets),
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
    indicators: {
        fields: {
            id: yes,
            code: yes,
        },
        filter: {
            code: { $like: baseConfig.indicators.actualTargetPrefix },
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
    displayName: string;
    userRoles: Array<{ name: string }>;
    organisationUnits: OrganisationUnit[];
};

export interface OrganisationUnit {
    id: Id;
    displayName: string;
}

export type DataElementGroupSet = GetItemType<Metadata["dataElementGroupSets"]>;

type NamedObject = { id: Id; displayName: string };
type CodedObject = { id: Id; code: string };

export type Sector = NamedObject;
export type Funder = NamedObject;

type IndexedObjs<Key extends keyof BaseConfig, ValueType> = Record<
    keyof BaseConfig[Key],
    ValueType
>;

type Attribute = CodedObject;
export type CategoryCombo = CodedObject;
export type CategoryOption = CodedObject;
export type Category = CodedObject & { categoryOptions: CategoryOption[] };
export type LegendSet = CodedObject;
export type Indicator = CodedObject;

export type Config = {
    base: typeof baseConfig;
    currentUser: CurrentUser;
    dataElements: DataElement[];
    sectors: Sector[];
    funders: Funder[];
    attributes: IndexedObjs<"attributes", Attribute>;
    categories: IndexedObjs<"categories", Category>;
    categoryCombos: IndexedObjs<"categoryCombos", CategoryCombo>;
    categoryOptions: IndexedObjs<"categoryOptions", CategoryOption>;
    legendSets: IndexedObjs<"legendSets", LegendSet>;
    indicators: Indicator[];
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
            ...d2CurrentUser,
            userRoles: d2CurrentUser.userCredentials.userRoles,
        };

        const config = {
            base: baseConfig,
            currentUser: currentUser,
            ...dataElementsMetadata,
            funders: _.sortBy(funders, funder => funder.displayName),
            indicators: metadata.indicators,
            attributes: indexObjects(metadata, "attributes"),
            categories: indexObjects(metadata, "categories"),
            categoryCombos: indexObjects(metadata, "categoryCombos"),
            categoryOptions: indexObjects(metadata, "categoryOptions"),
            legendSets: indexObjects(metadata, "legendSets"),
        };

        return config;
    }

    async getCurrentUser() {
        return this.api.currentUser
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

interface IndexableTypes {
    attributes: Attribute;
    categories: Category;
    categoryCombos: CategoryCombo;
    categoryOptions: CategoryOption;
    legendSets: LegendSet;
}

type IndexableKeys = keyof IndexableTypes;

function indexObjects<Key extends IndexableKeys, RetValue = IndexedObjs<Key, IndexableTypes[Key]>>(
    metadata: Metadata,
    key: Key
): RetValue {
    const keyByCodes = _.invert(baseConfig[key]) as Record<string, keyof BaseConfig[Key]>;
    const objects = metadata[key];
    return _(objects)
        .keyBy(obj => _(keyByCodes).get(obj.code))
        .pickBy()
        .value() as RetValue;
}

export async function getConfig(api: D2Api): Promise<Config> {
    return new ConfigLoader(api).get();
}

/* Runnable script to generate __tests__/config.json */

async function getFromApp(baseUrl: string) {
    const api = new D2ApiDefault({ baseUrl });
    const config = await getConfig(api);
    const jsonPath = path.join(__dirname, "__tests__", "config.json");
    fs.writeFileSync(jsonPath, JSON.stringify(config, null, 4) + "\n");
    console.log(`Written: ${jsonPath}`);
}

if (require.main === module) {
    const [baseUrl] = process.argv.slice(2);
    if (!baseUrl) throw new Error("Usage: config.ts DHIS2_URL");
    getFromApp(baseUrl);
}

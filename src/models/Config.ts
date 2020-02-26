import _ from "lodash";
import { D2ApiDefault, D2Api, Id, Ref, MetadataPick } from "d2-api";
import fs from "fs";
import path from "path";
import DataElementsSet, { DataElementBase } from "./dataElementsSet";
import { GetItemType } from "../types/utils";
import "../utils/lodash-mixins";

export type Config = {
    base: typeof baseConfig;
    currentUser: CurrentUser;
    dataElements: DataElementBase[];
    sectors: Sector[];
    funders: Funder[];
    locations: Location[];
    attributes: IndexedObjs<"attributes", Attribute>;
    categories: IndexedObjs<"categories", Category>;
    categoryCombos: IndexedObjs<"categoryCombos", CategoryCombo>;
    categoryOptions: IndexedObjs<"categoryOptions", CategoryOption>;
    legendSets: IndexedObjs<"legendSets", LegendSet>;
    indicators: Indicator[];
    countries: Country[];
    dataApprovalWorkflows: IndexedObjs<"dataApprovalWorkflows", DataApprovalWorkflow>;
};

const yes = true as const;

const baseConfig = {
    orgUnits: {
        levelForCountries: 2,
        levelForProjects: 3,
    },
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
        externals: "EXTERNAL",
    },
    attributes: {
        pairedDataElement: "PM_PAIRED_DE",
        createdByApp: "PM_CREATED_BY_PROJECT_MONITORING",
        orgUnitProject: "PM_ORGUNIT_PROJECT_ID",
        projectDashboard: "PM_PROJECT_DASHBOARD_ID",
        countingMethod: "PM_COUNTING_METHOD",
        mainSector: "PM_MAIN_SECTOR",
    },
    categories: {
        targetActual: "ACTUAL_TARGET",
        gender: "GENDER",
        newRecurring: "NEW_RECURRING",
    },
    categoryCombos: {
        targetActual: "ACTUAL_TARGET",
        genderNewRecurring: "GENDER_NEW_RECURRING",
        default: "default",
    },
    categoryOptions: {
        target: "TARGET",
        actual: "ACTUAL",
        new: "NEW",
        recurring: "RECURRING",
        male: "MALE",
        female: "FEMALE",
    },
    dataElementGroups: {
        global: "GLOBAL",
        sub: "SUB",
        custom: "CUSTOM",
        people: "PEOPLE",
        benefit: "BENEFIT",
    },
    legendSets: {
        achieved: "ACTUAL_TARGET_ACHIEVED",
    },
    organisationUnitGroupSets: {
        funder: "FUNDER",
        location: "LOCATION",
    },
    indicators: {
        actualTargetPrefix: "ACTUAL_TARGET_",
        costBenefitPrefix: "COST_BENEFIT_",
    },
    dataApprovalWorkflows: {
        project: "PM_PROJECT",
    },
};

function getParamsForIndexables(indexedCodes: _.Dictionary<string>) {
    return {
        fields: { id: yes, code: yes },
        filter: { code: { in: _.values(indexedCodes) } },
    };
}

const metadataParams = {
    categories: {
        fields: { id: yes, code: yes, categoryOptions: { id: yes, code: yes } },
        filter: { code: { in: _.values(baseConfig.categories) } },
    },
    attributes: getParamsForIndexables(baseConfig.attributes),
    categoryCombos: {
        fields: { id: yes, code: yes, categoryOptionCombos: { id: yes, displayName: yes } },
        filter: { code: { in: _.values(baseConfig.categoryCombos) } },
    },
    categoryOptions: getParamsForIndexables(baseConfig.categoryOptions),
    legendSets: getParamsForIndexables(baseConfig.legendSets),
    dataElements: {
        fields: {
            id: yes,
            code: yes,
            description: yes,
            attributeValues: { attribute: { id: yes, code: yes }, value: yes },
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
        fields: { id: yes, code: yes },
    },
    organisationUnits: {
        fields: { id: yes, displayName: yes },
        filter: { level: { eq: baseConfig.orgUnits.levelForCountries.toString() } },
    },
    organisationUnitGroupSets: {
        fields: {
            code: yes,
            organisationUnitGroups: {
                id: yes,
                shortName: yes,
                displayName: yes,
                organisationUnits: { id: yes, level: yes },
            },
        },
        filter: {
            code: {
                in: [
                    baseConfig.organisationUnitGroupSets.funder,
                    baseConfig.organisationUnitGroupSets.location,
                ],
            },
        },
    },
    dataApprovalWorkflows: {
        fields: { id: yes, code: yes },
        filter: {
            code: { in: _.values(baseConfig.dataApprovalWorkflows) },
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
    level: number;
}

export type DataElementGroupSet = GetItemType<Metadata["dataElementGroupSets"]>;

type NamedObject = { id: Id; displayName: string };
type CodedObject = { id: Id; code: string };

export type Sector = NamedObject & CodedObject;
export type Funder = NamedObject;
export type Country = NamedObject;
export type Location = NamedObject & { countries: Ref[] };
export type DataApprovalWorkflow = CodedObject;

type IndexedObjs<Key extends keyof BaseConfig, ValueType> = Record<
    keyof BaseConfig[Key],
    ValueType
>;

type Attribute = CodedObject;
export type CategoryCombo = CodedObject & { categoryOptionCombos: NamedObject[] };
export type CategoryOption = CodedObject;
export type Category = CodedObject & { categoryOptions: CategoryOption[] };
export type LegendSet = CodedObject;
export type Indicator = CodedObject;

class ConfigLoader {
    constructor(public api: D2Api) {}

    async get(): Promise<Config> {
        const metadata: Metadata = await this.api.metadata.get(metadataParams).getData();
        const d2CurrentUser = await this.getCurrentUser();
        const { funders, locations } = getFundersAndLocations(metadata);
        const { userRoles } = d2CurrentUser.userCredentials;
        const currentUser = { ...d2CurrentUser, userRoles };
        const dataElementsMetadata = await this.getDataElementsMetadata(currentUser, metadata);

        return {
            base: baseConfig,
            currentUser,
            ...dataElementsMetadata,
            funders,
            locations,
            indicators: metadata.indicators,
            attributes: indexObjects(metadata, "attributes"),
            categories: indexObjects(metadata, "categories"),
            categoryCombos: indexObjects(metadata, "categoryCombos"),
            categoryOptions: indexObjects(metadata, "categoryOptions"),
            legendSets: indexObjects(metadata, "legendSets"),
            dataApprovalWorkflows: indexObjects(metadata, "dataApprovalWorkflows"),
            countries: _.sortBy(metadata.organisationUnits, ou => ou.displayName),
        };
    }

    async getCurrentUser() {
        return this.api.currentUser
            .get({
                fields: {
                    id: true,
                    displayName: true,
                    userCredentials: { userRoles: { name: true } },
                    organisationUnits: { id: true, displayName: true, level: true },
                },
            })
            .getData();
    }

    async getDataElementsMetadata(currentUser: CurrentUser, metadata: Metadata) {
        const dataElements = await DataElementsSet.getDataElements(
            currentUser,
            baseConfig,
            metadata
        );
        const sectors = _(metadata.dataElementGroupSets)
            .keyBy(degSet => degSet.code)
            .getOrFail(baseConfig.dataElementGroupSets.sector).dataElementGroups;
        const sortedSectors = _.sortBy(sectors, sector => sector.displayName);
        return { sectors: sortedSectors, dataElements };
    }
}

interface IndexableTypes {
    attributes: Attribute;
    categories: Category;
    categoryCombos: CategoryCombo;
    categoryOptions: CategoryOption;
    legendSets: LegendSet;
    dataApprovalWorkflows: DataApprovalWorkflow;
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
    const allConfig = await getConfig(api);
    // Protect names for funders, locations and data elements.
    const config: Config = {
        ...allConfig,
        funders: allConfig.funders.map(funder => ({
            ...funder,
            displayName: `funder-${funder.id}`,
        })),
        locations: allConfig.locations.map(location => ({
            ...location,
            displayName: `loc-${location.id}`,
        })),
        dataElements: allConfig.dataElements.map(de => ({
            ...de,
            name: `de-${de.code}`,
            description: `de-description-${de.code}`,
            pairedDataElements: de.pairedDataElements.map(pde => ({
                ...pde,
                name: `pde-${pde.code}`,
            })),
        })),
    };
    const jsonPath = path.join(__dirname, "__tests__", "config.json");
    fs.writeFileSync(jsonPath, JSON.stringify(config, null, 4) + "\n");
    console.info(`Written: ${jsonPath}`);
}

function getFundersAndLocations(metadata: Metadata) {
    const ouSetsByCode = _(metadata.organisationUnitGroupSets).keyBy(ougSet => ougSet.code);

    const fundersSet = ouSetsByCode.getOrFail(baseConfig.organisationUnitGroupSets.funder);
    const funders = _(fundersSet.organisationUnitGroups)
        .map(funder => ({
            ...funder,
            displayName: _.compact([funder.displayName, funder.shortName]).join(" - "),
        }))
        .orderBy(
            [funder => funder.shortName === "IHQ", funder => funder.displayName],
            ["desc" as const, "asc" as const]
        )
        .value();

    const locationsSet = ouSetsByCode.getOrFail(baseConfig.organisationUnitGroupSets.location);
    const locations = _(locationsSet.organisationUnitGroups)
        .map(oug => ({
            id: oug.id,
            displayName: oug.displayName,
            countries: oug.organisationUnits
                .filter(ou => ou.level === 2)
                .map(ou => ({ id: ou.id })),
        }))
        .sortBy(location => location.displayName)
        .value();

    return { funders, locations };
}

if (require.main === module) {
    const [baseUrl] = process.argv.slice(2);
    if (!baseUrl) throw new Error("Usage: config.ts DHIS2_URL");
    getFromApp(baseUrl);
}

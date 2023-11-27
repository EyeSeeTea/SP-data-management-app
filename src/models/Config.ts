import _ from "lodash";
import { D2Api, Id, Ref, MetadataPick } from "../types/d2-api";
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
    organisationUnitGroupSets: IndexedObjs<"organisationUnitGroupSets", CodedObject>;
    attributes: IndexedObjs<"attributes", Attribute>;
    categories: IndexedObjs<"categories", Category>;
    categoryCombos: IndexedObjs<"categoryCombos", CategoryCombo>;
    allCategoryCombos: CategoryCombo[];
    categoryOptions: IndexedObjs<"categoryOptions", CategoryOption>;
    legendSets: IndexedObjs<"legendSets", LegendSet>;
    indicators: Indicator[];
    countries: Country[];
    dataApprovalLevels: IndexedObjs<"dataApprovalLevels", DataApprovalLevel>;
    dataApprovalWorkflows: IndexedObjs<"dataApprovalWorkflows", DataApprovalWorkflow>;
    userGroups: Record<string, UserGroup>;
    categoryOptionCombos: {
        newMale: Ref;
        newFemale: Ref;
        returningMale: Ref;
        returningFemale: Ref;
    };
    organisationUnitGroups: IndexedObjs<"organisationUnitGroups", CodedObject>;
};

const yes = true as const;

export const baseConfig = {
    orgUnits: {
        levelForCountries: 2,
        levelForProjects: 3,
    },
    userRoles: {
        feedback: ["DM Feedback"],
        dataReviewer: ["Data Reviewer"],
        dataViewer: ["Data Viewer"],
        admin: ["DM Admin"],
        dataEntry: ["Data Entry"],
        merApprover: ["MER Approver"],
    },
    dataElementGroupSets: {
        sector: "SECTOR",
        series: "SERIES",
        type1: "TYPE_1",
        type2: "TYPE_2",
        externals: "EXTERNAL",
    },
    attributes: {
        pairedDataElement: "DM_PAIRED_DE",
        extraDataElement: "DM_EXTRA_INFO_DE",
        createdByApp: "DM_CREATED_BY_DATA_MANAGEMENT",
        lastUpdatedData: "DM_LAST_UPDATED_DATA",
        orgUnitProject: "DM_ORGUNIT_PROJECT_ID",
        projectDashboard: "DM_PROJECT_DASHBOARD_ID",
        awardNumberDashboard: "DM_AWARD_NUMBER_DASHBOARD_ID",
        countingMethod: "DM_COUNTING_METHOD",
        mainSector: "DM_MAIN_SECTOR",
    },
    categories: {
        default: "default",
        targetActual: "ACTUAL_TARGET",
        gender: "GENDER",
        newRecurring: "NEW_RETURNING",
        covid19: "COVID19",
    },
    categoryCombos: {
        default: "default",
        targetActual: "ACTUAL_TARGET",
        covid19: "COVID19",
        genderNewRecurring: "NEW_RETURNING_GENDER",
        genderNewRecurringCovid19: "COVID19_NEW_RETURNING_GENDER",
        newRecurring: "NEW_RETURNING",
        covid19NewRecurring: "COVID19_NEW_RETURNING",
    },
    categoryOptions: {
        default: "default",
        target: "TARGET",
        actual: "ACTUAL",
        new: "NEW",
        recurring: "RETURNING",
        male: "MALE",
        female: "FEMALE",
        covid19: "COVID19",
        nonCovid19: "COVID19_NO",
    },
    dataElementGroups: {
        global: "GLOBAL",
        sub: "SUB",
        custom: "CUSTOM",
        people: "PEOPLE",
        benefit: "BENEFIT",
        reportableSub: "REPORTABLE_SUB",
    },
    legendSets: {
        achieved: "ACTUAL_TARGET_ACHIEVED",
    },
    organisationUnitGroupsPrefixes: {
        awardNumberPrefix: "AWARD_NUMBER_",
    },
    organisationUnitGroups: {
        isDartApplicable: "IS_DART_APPLICABLE",
    },
    organisationUnitGroupSets: {
        funder: "FUNDER",
        location: "LOCATION",
        awardNumber: "AWARD_NUMBER",
    },
    indicators: {
        actualTargetPrefix: "ACTUAL_TARGET_",
        costBenefitPrefix: "COST_BENEFIT_",
    },
    dataApprovalLevels: {
        project: "Project",
    },
    dataApprovalWorkflows: {
        project: "DM_PROJECT",
    },
    userGroups: {
        systemAdmin: "SYSTEM_ADMIN",
        appAdmin: "DATA_MANAGEMENT_ADMIN",
        countryAdminPrefix: "ADMIN_COUNTRY_",
    },
    merReports: {
        excludedSectors: ["SECTOR_MINISTRY"],
        maxExecutiveSummaries: 3,
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
        fields: {
            id: yes,
            code: yes,
            categoryOptions: { id: yes, code: yes },
            dataDimensionType: true,
        },
        filter: { code: { in: _.values(baseConfig.categories) } },
    },
    attributes: getParamsForIndexables(baseConfig.attributes),
    categoryCombos: {
        fields: {
            id: yes,
            code: yes,
            displayName: yes,
            categories: { id: yes, code: yes },
            categoryOptionCombos: {
                id: yes,
                displayName: yes,
                categoryOptions: { id: yes, displayName: yes, code: yes },
            },
        },
    },
    categoryOptions: {
        fields: { id: yes, code: yes, categoryOptionCombos: { id: yes } },
        filter: { code: { in: _.values(baseConfig.categoryOptions) } },
    },
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
        fields: { id: yes, code: yes, displayName: yes },
        filter: { level: { eq: baseConfig.orgUnits.levelForCountries.toString() } },
    },
    organisationUnitGroupSets: {
        fields: {
            id: yes,
            code: yes,
            organisationUnitGroups: {
                id: yes,
                shortName: yes,
                code: yes,
                displayName: yes,
                organisationUnits: { id: yes, level: yes },
            },
        },
        filter: {
            code: {
                in: [
                    baseConfig.organisationUnitGroupSets.funder,
                    baseConfig.organisationUnitGroupSets.location,
                    baseConfig.organisationUnitGroupSets.awardNumber,
                ],
            },
        },
    },
    dataApprovalLevels: {
        fields: { id: yes, code: yes, name: yes },
        filter: {
            name: { in: _.values(baseConfig.dataApprovalLevels) },
        },
    },
    dataApprovalWorkflows: {
        fields: { id: yes, code: yes },
        filter: {
            code: { in: _.values(baseConfig.dataApprovalWorkflows) },
        },
    },
    userGroups: {
        fields: { id: yes, code: yes, displayName: yes },
        filter: {
            code: { like: "ADMIN" },
        },
    },
    organisationUnitGroups: {
        fields: {
            id: yes,
            code: yes,
        },
        filter: {
            code: {
                in: [baseConfig.organisationUnitGroups.isDartApplicable],
            },
        },
    },
};

type OptionalName = { name: string | undefined };

export type Metadata = MetadataPick<typeof metadataParams>;
export type BaseConfig = typeof baseConfig;

export type CurrentUser = {
    id: Id;
    displayName: string;
    username: string;
    userRoles: Array<{ name: string }>;
    organisationUnits: OrganisationUnit[];
    authorities: string[];
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
export type Funder = NamedObject & { shortName: string; code: string };
export type Country = NamedObject & CodedObject;
export type Location = NamedObject & { countries: Ref[] };
export type DataApprovalWorkflow = CodedObject;
export type DataApprovalLevel = CodedObject;

type IndexedObjs<Key extends keyof BaseConfig, ValueType> = Record<
    keyof BaseConfig[Key],
    ValueType
>;

export type Attribute = CodedObject;
export type CategoryOptionCombo = NamedObject & { categoryOptions: CodedObject[] };
export type CategoryCombo = NamedObject &
    CodedObject & { categories: Ref[]; categoryOptionCombos: CategoryOptionCombo[] };
export type CategoryOption = CodedObject & { categoryOptionCombos: NamedObject[] };
export type Category = CodedObject & {
    categoryOptions: CategoryOption[];
    dataDimensionType: "DISAGGREGATION" | "ATTRIBUTE";
};
export type LegendSet = CodedObject;
export type Indicator = CodedObject;
export type UserGroup = NamedObject & CodedObject;

class ConfigLoader {
    constructor(public api: D2Api) {}

    async get(): Promise<Config> {
        const metadata: Metadata = await this.api.metadata.get(metadataParams).getData();
        const d2CurrentUser = await this.getCurrentUser();
        const { funders, locations } = getFundersAndLocations(metadata);
        const { userRoles, username } = d2CurrentUser.userCredentials;
        const currentUser: Config["currentUser"] = { ...d2CurrentUser, userRoles, username };
        const dataElementsMetadata = await this.getDataElementsMetadata(currentUser, metadata);
        const categoryCombos = indexObjects(metadata, "categoryCombos");
        const categoryOptionCombos = this.getCategoryOptionCombos(categoryCombos);

        return {
            base: baseConfig,
            currentUser,
            ...dataElementsMetadata,
            funders,
            locations,
            indicators: metadata.indicators,
            attributes: indexObjects(metadata, "attributes"),
            categories: indexObjects(metadata, "categories"),
            categoryCombos: categoryCombos,
            allCategoryCombos: metadata.categoryCombos,
            categoryOptions: indexObjects(metadata, "categoryOptions"),
            legendSets: indexObjects(metadata, "legendSets"),
            dataApprovalLevels: indexObjects(metadata, "dataApprovalLevels"),
            dataApprovalWorkflows: indexObjects(metadata, "dataApprovalWorkflows"),
            countries: _.sortBy(metadata.organisationUnits, ou => ou.displayName),
            userGroups: _.keyBy(metadata.userGroups, ug => ug.code),
            organisationUnitGroupSets: indexObjects(metadata, "organisationUnitGroupSets"),
            categoryOptionCombos: categoryOptionCombos,
            organisationUnitGroups: indexObjects(metadata, "organisationUnitGroups"),
        };
    }

    private getCategoryOptionCombos(categoryCombos: IndexedObjs<"categoryCombos", CategoryCombo>) {
        const cos = baseConfig.categoryOptions;
        return {
            newMale: getCocRef(categoryCombos, [cos.new, cos.male]),
            newFemale: getCocRef(categoryCombos, [cos.new, cos.female]),
            returningMale: getCocRef(categoryCombos, [cos.recurring, cos.male]),
            returningFemale: getCocRef(categoryCombos, [cos.recurring, cos.female]),
        };
    }

    async getCurrentUser() {
        return this.api.currentUser
            .get({
                fields: {
                    id: true,
                    displayName: true,
                    userCredentials: { username: true, userRoles: { name: true } },
                    organisationUnits: { id: true, displayName: true, level: true },
                    authorities: true,
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
    dataApprovalLevels: DataApprovalLevel;
    organisationUnitGroupSets: CodedObject;
    organisationUnitGroups: CodedObject;
}

type IndexableKeys = keyof IndexableTypes;

function indexObjects<Key extends IndexableKeys, RetValue = IndexedObjs<Key, IndexableTypes[Key]>>(
    metadata: Metadata,
    key: Key
): RetValue {
    const keyByCodes = _.invert(baseConfig[key]) as Record<string, keyof BaseConfig[Key]>;
    const objects = metadata[key];
    const indexedObjects = _(objects)
        .keyBy(obj =>
            // Key by obj.code or obj.name (add type as virtual field)
            _(keyByCodes).get(obj.code || (obj as typeof obj & OptionalName).name || "")
        )
        .pickBy()
        .value() as RetValue;
    const missingKeys = _.difference(_.values(keyByCodes) as string[], _.keys(indexedObjects));

    if (!_.isEmpty(missingKeys)) {
        const msg = `[Config] Missing records for ${key}: ${missingKeys.join(", ")}`;
        console.error(msg);
        throw new Error(msg);
    } else {
        return indexedObjects;
    }
}
export async function getConfig(api: D2Api): Promise<Config> {
    return new ConfigLoader(api).get();
}

/* Runnable script to generate __tests__/config.json */

async function getFromApp(baseUrl: string) {
    const api = new D2Api({ baseUrl });
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

function getCocRef(categoryCombos: Config["categoryCombos"], codes: string[]): Ref {
    const coc = categoryCombos.genderNewRecurring.categoryOptionCombos.find(
        coc =>
            _(coc.categoryOptions)
                .map(co => co.code)
                .difference(codes)
                .size() === 0
    );
    if (!coc) throw new Error(`Cannot get category option combo: ${codes}`);
    return coc;
}

if (require.main === module) {
    const [baseUrl] = process.argv.slice(2);
    if (!baseUrl) throw new Error("Usage: config.ts DHIS2_URL");
    getFromApp(baseUrl);
}

import parse from "parse-typed-args";
import _ from "lodash";
import csvToJson from "csvtojson";
import { createObjectCsvWriter } from "csv-writer";

import { D2Api, DataValueSetsDataValue, D2DataSet } from "../types/d2-api";
import { getApp } from "./common";
import { promiseMap } from "../migrations/utils";

const DE_MINISTRY_VISIT_ID = "WUMjtbgofs2";
const DE_GROUP_ID = "i8qug2Himby";
const DEFAULT_COC_ID = "HllvX50cXC0";
const TARGET_COC_ID = "I8cbuxMTjjs";
const ACTUAL_COC_ID = "oJXO2VVYWZa";
const NEW_COC_ID = "Wj7wjri7dUs";
const RETURNING_COC_ID = "bALUpFAqhLq";
const DEFAULT_CATEGORY_COMBO_NAME = "default";

async function main() {
    const parser = parse({
        opts: {
            url: {},
            filePath: {},
            csvPath: {},
        },
    });
    const { opts } = parser(process.argv);

    if (!opts.url) return;
    if (!opts.filePath) return;
    if (!opts.csvPath) return;

    const { api } = await getApp({ baseUrl: opts.url });
    const metadata = await getMetadata(api);

    const defaultCategoryCombo = metadata.categoryCombos.find(
        categoryCombo => categoryCombo.name === DEFAULT_CATEGORY_COMBO_NAME
    );
    if (!defaultCategoryCombo) throw Error(`Cannot found default categoryCombo`);

    const dataValuesFromCsv = await readCsv(opts.filePath);
    const { orgUnitIds, periods } = extractOrgUnitsAndPeriods(dataValuesFromCsv);

    console.debug("Fetching Org Units...");
    const orgUnits = await getOrgUnitByIds(api, orgUnitIds);

    console.debug("Fetching DataValues...");
    const dataValues = await getDataValues(api, orgUnitIds, periods);
    const onlyMinistryVisitDv = dataValues.filter(
        dv =>
            dv.dataElementId === DE_MINISTRY_VISIT_ID &&
            (dv.categoryOptionComboId === NEW_COC_ID ||
                dv.categoryOptionComboId === RETURNING_COC_ID)
    );

    const ministryDe = metadata.dataElements.find(de => de.id === DE_MINISTRY_VISIT_ID);
    if (!ministryDe) throw Error(`Cannot found dataElement ${DE_MINISTRY_VISIT_ID}`);
    console.debug(`${onlyMinistryVisitDv.length} dataValues for dataElement: ${ministryDe.code}`);

    const dataValuesToSave = generateDataValuesToSave(
        onlyMinistryVisitDv,
        DEFAULT_COC_ID,
        TARGET_COC_ID,
        ACTUAL_COC_ID
    );

    const dvToDelete = dataValuesToSave.filter(dv => dv.deleted);
    console.debug(`${dvToDelete.length} dataValues marked as deleted`);
    console.debug(`${dataValuesToSave.length - dvToDelete.length} dataValues to import`);

    console.debug("Saving dataValues...");
    const resultStats = await saveDataValues(dataValuesToSave, api);

    const stats = combineStats(resultStats);

    console.debug("DataValue Stats", JSON.stringify(stats, null, 4));

    console.debug(`${metadata.dataSets.length} dataSets found`);
    const dataSetsToUpdate = updateCategoryComboInDataSets(metadata, defaultCategoryCombo);

    console.debug("Saving DataSets...");
    const dataSetResponse = await saveDataSets(dataSetsToUpdate, api);
    const dataSetStats = combineStats(dataSetResponse);

    console.debug("DataSet Stats", JSON.stringify(dataSetStats, null, 4));

    await generateReport(dataValuesToSave, orgUnits, metadata, opts.csvPath);
    console.debug(`Report generated: ${opts.csvPath}`);
}

function updateCategoryComboInDataSets(
    metadata: Metadata,
    defaultCategoryCombo: CategoryCombo
): DataSet[] {
    return metadata.dataSets.map(dataSet => {
        const dataSetElements = dataSet.dataSetElements.map(dse => {
            return {
                ...dse,
                categoryCombo: {
                    id:
                        dse.dataElement.id === DE_MINISTRY_VISIT_ID
                            ? defaultCategoryCombo.id
                            : dse.categoryCombo.id,
                },
            };
        });
        return { ...dataSet, dataSetElements };
    });
}

async function saveDataSets(dataSets: DataSet[], api: D2Api): Promise<Stats[]> {
    const dataSetIdsToSave = dataSets.map(dataSet => dataSet.id);
    const stats = await promiseMap(_.chunk(dataSetIdsToSave, 50), async dataSetsIds => {
        const dataSetResponse = await api.metadata
            .get({
                dataSets: {
                    fields: {
                        $owner: true,
                    },
                    filter: {
                        id: {
                            in: dataSetsIds,
                        },
                    },
                    paging: false,
                },
            })
            .getData();

        const dataSetsToSave = dataSetsIds.map(dataSetId => {
            const existingD2DataSet = dataSetResponse.dataSets.find(
                d2DataSet => d2DataSet.id === dataSetId
            );
            const currentDataSet = dataSets.find(dataSet => dataSet.id === dataSetId);
            if (!currentDataSet) {
                throw Error(`Cannot find dataSet ${dataSetId}`);
            }

            return {
                ...(existingD2DataSet || {}),
                dataSetElements: currentDataSet.dataSetElements,
            };
        });

        const d2Response = await api.metadata
            .post(
                {
                    dataSets: dataSetsToSave,
                },
                { importStrategy: "UPDATE" }
            )
            .getData();

        if (d2Response.status === "ERROR") {
            console.error(d2Response.status);
            throw Error(JSON.stringify(d2Response, null, 4));
        }

        return {
            imported: d2Response.stats.created,
            updated: d2Response.stats.updated,
            deleted: d2Response.stats.deleted,
            ignored: d2Response.stats.ignored,
        };
    });
    return stats;
}

async function readCsv(filePath: string): Promise<DataValueCsv[]> {
    const json = await csvToJson({
        headers: ["orgUnit", "period", "dataElement", "aocId", "cocId", "value"],
    }).fromFile(filePath);
    return json;
}

function extractOrgUnitsAndPeriods(dataValues: DataValueCsv[]): {
    orgUnitIds: Id[];
    periods: Id[];
} {
    const orgUnitIds = _(dataValues)
        .map(dv => dv.orgUnit)
        .uniq()
        .value();
    const periods = _(dataValues)
        .map(dv => dv.period)
        .uniq()
        .value();
    return { orgUnitIds, periods };
}

async function getDataValues(api: D2Api, orgUnitIds: Id[], periods: Period[]) {
    const dataValues = await api.dataValues
        .getSet({
            orgUnit: orgUnitIds,
            dataSet: [],
            dataElementGroup: [DE_GROUP_ID],
            period: periods,
        })
        .getData();

    return dataValues.dataValues.map(buildDataValue);
}

function buildDataValue(d2DataValue: DataValueSetsDataValue): DataValue {
    return {
        dataElementId: d2DataValue.dataElement,
        attributeOptionComboId: d2DataValue.attributeOptionCombo,
        categoryOptionComboId: d2DataValue.categoryOptionCombo,
        deleted: d2DataValue.deleted ?? false,
        orgUnitId: d2DataValue.orgUnit,
        period: d2DataValue.period,
        value: d2DataValue.value,
        created: d2DataValue.created,
        followup: d2DataValue.followup,
        lastUpdated: d2DataValue.lastUpdated,
        storedBy: d2DataValue.storedBy,
    };
}

async function getOrgUnitByIds(api: D2Api, ids: Id[]): Promise<OrgUnit[]> {
    const response = await api.metadata
        .get({
            organisationUnits: {
                fields: { id: true, code: true },
                filter: {
                    id: { in: ids },
                },
            },
        })
        .getData();

    return response.organisationUnits;
}

async function generateReport(
    dataValues: DataValue[],
    orgUnits: OrgUnit[],
    metadata: Metadata,
    csvPath: string
): Promise<void> {
    const orgUnitsById = _.keyBy(orgUnits, ou => ou.id);
    const csvWriter = createObjectCsvWriter({
        path: csvPath,
        header: [
            {
                id: "orgunit",
                title: "orgunit",
            },
            {
                id: "period",
                title: "Period",
            },
            {
                id: "dataelement",
                title: "dataelement",
            },
            {
                id: "aoc",
                title: "aoc",
            },
            {
                id: "coc",
                title: "coc",
            },
            {
                id: "value",
                title: "value",
            },
            {
                id: "deleted",
                title: "Deleted?",
            },
        ],
    });

    const csvData = dataValues.map(dv => {
        const orgUnit = orgUnitsById[dv.orgUnitId];
        const aocDetails = metadata.categoryOptionCombos.find(
            coc => coc.id === dv.attributeOptionComboId
        );
        const cocDetails = metadata.categoryOptionCombos.find(
            coc => coc.id === dv.categoryOptionComboId
        );
        const dataElementDetails = metadata.dataElements.find(de => de.id === dv.dataElementId);
        return {
            orgunit: orgUnit.code,
            period: dv.period,
            dataelement: dataElementDetails?.code || dv.dataElementId,
            aoc: aocDetails?.name || dv.attributeOptionComboId,
            coc: cocDetails?.name || dv.categoryOptionComboId,
            value: dv.value,
            deleted: dv.deleted ? "Yes" : "-",
        };
    });

    await csvWriter.writeRecords(csvData);
}

async function getMetadata(api: D2Api): Promise<Metadata> {
    const d2Response = await api.metadata
        .get({
            categoryOptionCombos: {
                fields: { id: true, name: true },
                filter: {
                    id: {
                        in: [
                            ACTUAL_COC_ID,
                            DEFAULT_COC_ID,
                            TARGET_COC_ID,
                            NEW_COC_ID,
                            RETURNING_COC_ID,
                        ],
                    },
                },
            },
            dataElements: {
                fields: {
                    id: true,
                    code: true,
                },
                filter: { id: { eq: DE_MINISTRY_VISIT_ID } },
            },
            categoryCombos: {
                fields: {
                    id: true,
                    name: true,
                },
                filter: {
                    code: {
                        eq: DEFAULT_CATEGORY_COMBO_NAME,
                    },
                },
            },
        })
        .getData();

    const d2DataSetResponse = await api
        .request<{ dataSets: D2DataSet[] }>({
            method: "get",
            url: "/dataSets",
            params: {
                fields: "id,dataSetElements",
                filter: `dataSetElements.dataElement.id:eq:${DE_MINISTRY_VISIT_ID}`,
                paging: false,
            },
        })
        .getData();

    return {
        dataElements: d2Response.dataElements,
        categoryOptionCombos: d2Response.categoryOptionCombos,
        dataSets: d2DataSetResponse.dataSets,
        categoryCombos: d2Response.categoryCombos,
    };
}

function combineStats(
    resultStats: { imported: number; updated: number; ignored: number; deleted: number }[]
) {
    return resultStats.reduce(
        (acum, item) => {
            return {
                deleted: acum.deleted + item.deleted,
                ignored: acum.ignored + item.ignored,
                updated: acum.updated + item.updated,
                imported: acum.imported + item.imported,
            };
        },
        {
            deleted: 0,
            ignored: 0,
            updated: 0,
            imported: 0,
        }
    );
}

function generateDataValuesToSave(
    dataValues: DataValue[],
    defaultCocId: string,
    targetCocId: string,
    actualCocId: string
): DataValue[] {
    const dataValuesByKeys = _(dataValues)
        .groupBy(dv => `${dv.orgUnitId}.${dv.period}.${dv.dataElementId}`)
        .value();

    const keys = Object.keys(dataValuesByKeys);
    return _(keys)
        .flatMap((key): DataValue[] => {
            const currentDv = dataValuesByKeys[key];
            if (!currentDv) return [];
            const [orgUnitId, period, dataElementId] = key.split(".");

            const targetValue = getValuesAndSum(currentDv, targetCocId);
            const defaultTargetDv = {
                dataElementId,
                period,
                orgUnitId,
                categoryOptionComboId: defaultCocId,
                attributeOptionComboId: targetCocId,
                value: targetValue,
                deleted: false,
            };

            const actualValue = getValuesAndSum(currentDv, actualCocId);
            const defaultActualDv = {
                dataElementId,
                period,
                orgUnitId,
                categoryOptionComboId: defaultCocId,
                attributeOptionComboId: actualCocId,
                value: actualValue,
                deleted: false,
            };

            const markDvAsDeleted = currentDv.map(dv => {
                return { ...dv, deleted: true };
            });

            return [defaultActualDv, defaultTargetDv, ...markDvAsDeleted];
        })
        .map(dataValue => {
            return dataValue.value !== "" ? dataValue : undefined;
        })
        .compact()
        .value();
}

function getValuesAndSum(currentDv: DataValue[], optionComboId: string): string {
    const values = _(currentDv)
        .map(dv => dv.value && optionComboId === dv.attributeOptionComboId)
        .compact()
        .value();

    const currentValue =
        values.length > 0
            ? _(currentDv).sumBy(dv =>
                  dv.attributeOptionComboId === optionComboId ? Number(dv.value) : 0
              )
            : "";

    return String(currentValue);
}

async function saveDataValues(dataValuesToSave: DataValue[], api: D2Api) {
    return await promiseMap(_.chunk(dataValuesToSave, 200), async dataValues => {
        const response = await api.dataValues
            .postSet(
                { force: true },
                { dataValues: dataValues.map(dv => convertToD2DataValue(dv)) }
            )
            .response();

        if (response.data.status !== "SUCCESS") {
            throw new Error(`Error on post: ${JSON.stringify(response, null, 4)}`);
        }

        return response.data.importCount;
    });
}

function convertToD2DataValue(dataValue: DataValue) {
    return {
        dataElement: dataValue.dataElementId,
        attributeOptionCombo: dataValue.attributeOptionComboId,
        categoryOptionCombo: dataValue.categoryOptionComboId,
        deleted: dataValue.deleted,
        orgUnit: dataValue.orgUnitId,
        period: dataValue.period,
        value: dataValue.value,
        created: dataValue.created,
        followup: dataValue.followup,
        lastUpdated: dataValue.lastUpdated,
        storedBy: dataValue.storedBy,
    };
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

type Id = string;
type Code = string;
type Period = string;

type DataValue = {
    dataElementId: Id;
    period: Period;
    orgUnitId: Id;
    categoryOptionComboId: Id;
    attributeOptionComboId: Id;
    value: string;
    deleted: boolean;
    storedBy?: string;
    created?: string;
    lastUpdated?: string;
    followup?: boolean;
};

type DataValueCsv = {
    orgUnit: Code;
    period: Period;
    dataElement: Id;
    aocId: Id;
    cocId: Id;
    value: string;
};

type OrgUnit = {
    id: Id;
    code: Code;
};

type DataElement = {
    id: Id;
    code: Code;
};

type CategoryOptionCombo = {
    id: Id;
    name: string;
};

type DataSet = {
    id: Id;
    dataSetElements: {
        dataElement: {
            id: Id;
        };
        categoryCombo: {
            id: Id;
        };
    }[];
};

type CategoryCombo = {
    id: Id;
    name: string;
};

type Metadata = {
    dataElements: DataElement[];
    categoryOptionCombos: CategoryOptionCombo[];
    dataSets: DataSet[];
    categoryCombos: CategoryCombo[];
};

type Stats = {
    imported: number;
    updated: number;
    deleted: number;
    ignored: number;
};

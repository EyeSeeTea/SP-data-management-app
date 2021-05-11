import _ from "lodash";
import parse from "parse-typed-args";
import { D2Api, DataValueSetsDataValue, Id } from "../types/d2-api";
import { App, assert, getApp, getCocsMapping, postDataValues, writeDataFilePath } from "./common";

main().catch(err => {
    console.error(err);
    process.exit(1);
});

const paths = {
    dataValuesOld: "wrong-datavalues-old.json",
    dataValuesToDelete: "wrong-datavalues-to-delete.json",
};

async function main() {
    const parser = parse({
        opts: {
            url: {},
            generate: { switch: true },
            post: { switch: true },
        },
    });
    const { opts } = parser(process.argv);

    const usage = "delete-wrong-data-values --url=DHIS2URL [--generate | --post]";
    const app = opts.url ? await getApp({ baseUrl: opts.url }) : null;

    if (!app) {
        console.error(usage);
    } else if (opts.generate) {
        await getDataValues(app);
    } else if (opts.post) {
        await postDataValues(app.api, paths.dataValuesToDelete, "DELETE");
    } else {
        console.error(usage);
    }
}

async function getDataValues(app: App) {
    const { api } = app;

    const { dataValues: dataValues0 } = await api.dataValues
        .getSet({
            dataSet: [""],
            orgUnit: [""],
            orgUnitGroup: ["xm24UfiG9nf"], // All projects
            startDate: "1970",
            endDate: (new Date().getFullYear() + 1).toString(),
            dataElementGroup: ["OUwLDu1i5xa", "SMkbYuGmadE"], // People+Benefit data elements
        })
        .getData();

    const dataValues = _(dataValues0)
        .orderBy([
            dv => dv.orgUnit,
            dv => dv.period,
            dv => dv.attributeOptionCombo,
            dv => dv.dataElement,
        ])
        .value();

    console.log(`Data values: ${dataValues.length}`);

    const { dataSets, categoryOptionCombos, attributes } = await api.metadata
        .get({
            dataSets: {
                fields: {
                    id: true,
                    dataSetElements: {
                        categoryCombo: { id: true, name: true },
                        dataElement: { id: true },
                    },
                    attributeValues: { attribute: { id: true }, value: true },
                },
            },
            categoryOptionCombos: {
                fields: { id: true, name: true },
            },
            attributes: {
                fields: { id: true, code: true },
            },
        })
        .getData();

    const projectAttribute = attributes.find(attr => attr.code === "DM_ORGUNIT_PROJECT_ID");
    assert(projectAttribute, "Cannot get project attribute");

    const cocsMapping = await getCocsMapping(app);
    const cocsMappingInverse = _.invert(cocsMapping);

    const cocsById = _.keyBy(categoryOptionCombos, coc => coc.id);

    const existingOrgUnitDataElementPairsA: string[] = [];

    const validKeysArray = _(dataSets)
        .flatMap(dataSet => {
            const orgUnitId = dataSet.attributeValues.find(
                av => av.attribute.id === projectAttribute.id
            )?.value;
            assert(orgUnitId, `Cannot get orgunit for data set: ${dataSet.id}`);

            return dataSet.dataSetElements.map(dse => {
                existingOrgUnitDataElementPairsA.push([orgUnitId, dse.dataElement.id].join("."));
                const isCovid = dse.categoryCombo.name.includes("COVID");
                const key = [orgUnitId, dse.dataElement.id, isCovid].join(".");
                return key;
            });
        })
        .value();

    const existingOrgUnitDataElementPairs = new Set(existingOrgUnitDataElementPairsA);
    const validKeys = new Set(validKeysArray);

    const wrongDataValues = _(dataValues)
        .filter(dv => {
            const coc = cocsById[dv.categoryOptionCombo];
            assert(coc);
            const isCovid = coc.name.includes("COVID");
            const key = [dv.orgUnit, dv.dataElement, isCovid].join(".");
            return !validKeys.has(key);
        })
        .value();

    const dataValuesById = _.keyBy(dataValues, getDataValueId);
    const getDataValueWithNames = await buildGetDataValueWithNames(api);

    const notMachingDataValues = _(wrongDataValues)
        .map(wrongDataValue => {
            const relatedCocId =
                cocsMapping[wrongDataValue.categoryOptionCombo] ||
                cocsMappingInverse[wrongDataValue.categoryOptionCombo];
            if (!relatedCocId) return null;

            const dvId = getDataValueId({ ...wrongDataValue, categoryOptionCombo: relatedCocId });
            const dataValue = _(dataValuesById).get(dvId, null);

            const key = [wrongDataValue.orgUnit, wrongDataValue.dataElement].join(".");
            const nonMatchingDataValue =
                existingOrgUnitDataElementPairs.has(key) &&
                wrongDataValue.value !== "0" &&
                (!dataValue || dataValue.value !== wrongDataValue.value);

            return nonMatchingDataValue ? { current: dataValue, toDelete: wrongDataValue } : null;
        })
        .compact()
        .value();

    const notMachingDataValuesHuman = _(notMachingDataValues)
        .map(({ current, toDelete }) => ({
            current: getDataValueWithNames(current),
            toDelete: getDataValueWithNames(toDelete),
        }))
        .value();

    const dataValueToDelete = _.differenceBy(
        wrongDataValues,
        notMachingDataValues.filter(({ current }) => !current).map(o => o.toDelete),
        getDataValueId
    );

    writeDataFilePath("non-matching-data-values.json", notMachingDataValues);
    writeDataFilePath("non-matching-data-values-with-names.json", notMachingDataValuesHuman);
    writeDataFilePath(paths.dataValuesOld, dataValues);
    writeDataFilePath(paths.dataValuesToDelete, { dataValues: dataValueToDelete });

    console.log(`Non-matching data values: ${notMachingDataValues.length}`);
    console.log(`Data values wrong: ${wrongDataValues.length}`);
    console.log(`Data values to delete: ${dataValueToDelete.length}`);
}

type DataValue = DataValueSetsDataValue;

function getNamesById(objs: Array<{ id: Id; name: string }>): Record<Id, string> {
    return _(objs)
        .map(obj => [obj.id, obj.name])
        .fromPairs()
        .value();
}

async function buildGetDataValueWithNames(api: D2Api) {
    const { dataElements, organisationUnits, categoryOptionCombos } = await api.metadata
        .get({
            dataElements: { fields: { id: true, name: true } },
            organisationUnits: { fields: { id: true, name: true } },
            categoryOptionCombos: { fields: { id: true, name: true } },
        })
        .getData();

    const orgUnitsById = getNamesById(organisationUnits);
    const dataElementsById = getNamesById(dataElements);
    const cocsById = getNamesById(categoryOptionCombos);

    return function (dv: DataValue | null): Omit<DataValue, "comment" | "followup"> | string {
        if (!dv) return "No value";

        return {
            ..._.omit(dv, ["comment", "followup"]),
            dataElement: _(dataElementsById).getOrFail(dv.dataElement),
            orgUnit: _(orgUnitsById).getOrFail(dv.orgUnit),
            categoryOptionCombo: _(cocsById).getOrFail(dv.categoryOptionCombo),
            attributeOptionCombo: _(cocsById).getOrFail(dv.attributeOptionCombo),
        };
    };
}

function getDataValueId(dataValue: DataValue): string {
    return [
        dataValue.dataElement,
        dataValue.period,
        dataValue.orgUnit,
        dataValue.categoryOptionCombo,
        dataValue.attributeOptionCombo,
    ].join(".");
}

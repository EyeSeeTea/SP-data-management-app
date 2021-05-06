import _ from "lodash";
import parse from "parse-typed-args";
import { DataValueSetsDataValue } from "../types/d2-api";
import { App, assert, getApp, getCocsMapping, postDataValues, writeDataFilePath } from "./common";

main().catch(err => {
    console.error(err);
    process.exit(1);
});

const paths = {
    dataValuesOld: "wrong-datavalues-old.json",
    dataValuesWrong: "wrong-datavalues-to-delete.json",
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
        await postDataValues(app.api, paths.dataValuesWrong, "DELETE");
    } else {
        console.error(usage);
    }
}

async function getDataValues(app: App) {
    const { api } = app;

    const { dataValues } = await api.dataValues
        .getSet({
            dataSet: [""],
            orgUnit: [""],
            orgUnitGroup: ["xm24UfiG9nf"], // All projects
            startDate: "1970",
            endDate: (new Date().getFullYear() + 1).toString(),
            dataElementGroup: ["OUwLDu1i5xa", "SMkbYuGmadE"], // People+Benefit data elements
            limit: 1e7,
        })
        .getData();

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

    const validKeysArray = _(dataSets)
        .flatMap(dataSet => {
            const orgUnitId = dataSet.attributeValues.find(
                av => av.attribute.id === projectAttribute.id
            )?.value;
            assert(orgUnitId, `Cannot get orgunit for data set: ${dataSet.id}`);

            return dataSet.dataSetElements.map(dse => {
                const isCovid = dse.categoryCombo.name.includes("COVID");
                const key = [orgUnitId, dse.dataElement.id, isCovid].join(".");
                return key;
            });
        })
        .value();

    const validKeys = new Set(validKeysArray);

    const wrongDataValues = dataValues.filter(dv => {
        const coc = cocsById[dv.categoryOptionCombo];
        assert(coc);
        const isCovid = coc.name.includes("COVID");
        const key = [dv.orgUnit, dv.dataElement, isCovid].join(".");
        return !validKeys.has(key);
    });

    const dataValuesById = _.keyBy(dataValues, getDataValueId);

    const notMachingDataValues = _(wrongDataValues)
        .map(wrongDataValue => {
            const relatedCocId =
                cocsMapping[wrongDataValue.categoryOptionCombo] ||
                cocsMappingInverse[wrongDataValue.categoryOptionCombo];
            if (!relatedCocId) return;

            const dvId = getDataValueId({ ...wrongDataValue, categoryOptionCombo: relatedCocId });
            const dataValue = _(dataValuesById).get(dvId, null);

            const isWarning =
                dataValue &&
                wrongDataValue.value !== "0" &&
                dataValue.value !== "0" &&
                dataValue.value !== wrongDataValue.value;

            return isWarning ? { dataValue, wrongDataValue } : null;
        })
        .compact()
        .value();

    writeDataFilePath("non-matching-data-values.json", notMachingDataValues);

    console.log(`Non-matching data values: ${notMachingDataValues.length}`);
    console.log(`Data values to delete: ${wrongDataValues.length}`);

    writeDataFilePath(paths.dataValuesOld, dataValues);
    writeDataFilePath(paths.dataValuesWrong, { dataValues: wrongDataValues });
}

function getDataValueId(dataValue: DataValueSetsDataValue): string {
    return [
        dataValue.dataElement,
        dataValue.period,
        dataValue.orgUnit,
        dataValue.categoryOptionCombo,
        dataValue.attributeOptionCombo,
    ].join(".");
}

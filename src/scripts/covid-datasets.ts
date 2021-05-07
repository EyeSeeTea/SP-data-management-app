import _ from "lodash";
import parse from "parse-typed-args";
import { Config } from "../models/Config";
import { D2ModelSchemas, Id, MetadataPayloadBase } from "../types/d2-api";
import {
    App,
    assert,
    categoryCombosMapping,
    getApp,
    getCocsMapping,
    postDataValues,
    readDataFilePath,
    writeDataFilePath,
} from "./common";

main().catch(err => {
    console.error(err);
    process.exit(1);
});

const paths = {
    dataSetsOrig: "covid-datasets-orig.json",
    dataSetsNew: "covid-datasets-new.json",
    dataValuesOld: "covid-datavalues-old.json",
    dataValuesNew: "covid-datavalues-new.json",
};

async function main() {
    const parser = parse({
        opts: {
            url: {},
            generate: { switch: true },
            postDataSets: { switch: true },
            postDataValues: { switch: true },
        },
    });
    const { opts } = parser(process.argv);

    const usage = "covid-datasets --url=DHIS2URL [--generate | --postDataSets | --postDataValues]";
    const app = opts.url ? await getApp({ baseUrl: opts.url }) : null;

    if (!app) {
        console.error(usage);
    } else if (opts.generate) {
        const update = await getDataSets(app);
        await getDataValues(app, update);
    } else if (opts.postDataSets) {
        await postDataSets(app);
    } else if (opts.postDataValues) {
        await postDataValues(app.api, paths.dataValuesNew, "CREATE_AND_UPDATE");
    } else {
        console.error(usage);
    }
}

type DataValueUpdate = ItemUpdate[];

interface ItemUpdate {
    dataSetId: Id;
    dataElementId: Id;
    orgUnitId: Id;
}

async function getDataValues(app: App, update: DataValueUpdate) {
    const { api } = app;

    const { dataValues } = await api.dataValues
        .getSet({
            dataSet: [""],
            orgUnit: [""],
            orgUnitGroup: ["xm24UfiG9nf"], // All projects
            startDate: "1970",
            endDate: (new Date().getFullYear() + 1).toString(),
            dataElementGroup: ["OUwLDu1i5xa"], // People data elements
        })
        .getData();
    console.log(`Data values: ${dataValues.length}`);

    const cocsMapping = await getCocsMapping(app);
    const updatesByKey = _.keyBy(update, u => [u.dataElementId, u.orgUnitId].join("."));

    const dataValuesUpdated = _(dataValues)
        .map(dv => {
            const key = [dv.dataElement, dv.orgUnit].join(".");
            const update = updatesByKey[key];
            if (!update) return null;
            const newCocId = _(cocsMapping).getOrFail(dv.categoryOptionCombo);
            if (dv.categoryOptionCombo === newCocId) return null;

            return { ...dv, categoryOptionCombo: newCocId };
        })
        .compact()
        .value();

    console.log(`Data values to update: ${dataValuesUpdated.length}`);

    writeDataFilePath(paths.dataValuesOld, { dataValues: dataValues });
    writeDataFilePath(paths.dataValuesNew, { dataValues: dataValuesUpdated });
}

async function postDataSets(app: App) {
    const { api } = app;
    const metadata = readDataFilePath(paths.dataSetsNew) as Partial<
        MetadataPayloadBase<D2ModelSchemas>
    >;
    const res = await api.metadata.post(metadata).getData();
    console.log(res);
    assert(res.status === "OK", `Post data sets error: ${JSON.stringify(res)}`);
}

async function getDataSets(app: App): Promise<DataValueUpdate> {
    const { api, config } = app;
    const getParent = getParentFn(config);

    const { categoryCombos, dataSets, attributes, dataElements } = await api.metadata
        .get({
            categoryCombos: {
                fields: {
                    id: true,
                    name: true,
                    categoryOptionCombos: { id: true, name: true },
                },
            },
            dataSets: {
                fields: { $owner: true },
            },
            dataElements: {
                fields: { id: true, name: true },
            },
            attributes: {
                fields: { id: true, code: true },
            },
        })
        .getData();

    const categoryCombosByName = _.keyBy(categoryCombos, cc => cc.name);
    const categoryCombosById = _.keyBy(categoryCombos, cc => cc.id);
    const dataElementsById = _.keyBy(dataElements, de => de.id);
    const projectAttribute = attributes.find(attr => attr.code === "DM_ORGUNIT_PROJECT_ID");
    assert(projectAttribute, "Cannot get project attribute");

    const getMappedCategoryCombo = (ccId: string) => {
        const ccName = categoryCombosById[ccId]?.name;
        assert(ccName, "Category combo not found");
        const mappedCcName = categoryCombosMapping[ccName];
        return mappedCcName ? categoryCombosByName[mappedCcName] : undefined;
    };

    const dataValueUpdate: DataValueUpdate = [];

    const changes: Array<{ dataSet: string; dataElement: string }> = [];

    const dataSetsUpdated0 = dataSets.map(dataSet => {
        const orgUnitId = dataSet.attributeValues.find(
            av => av.attribute.id === projectAttribute.id
        )?.value;
        assert(orgUnitId, `Cannot get orgunit for data set: ${dataSet.id}`);

        const dataSetElementsUpdated = dataSet.dataSetElements.map(dse => {
            const dataElement = dataElementsById[dse.dataElement.id];
            const dataElementId = dse.dataElement.id;
            const parent = getParent(dataElementId);
            if (!parent) return dse;

            const parentCategoryCombo = _(dataSet.dataSetElements)
                .map(dse_ =>
                    dse_.dataElement.id === parent.id
                        ? categoryCombosById[dse_.categoryCombo.id]
                        : null
                )
                .compact()
                .first();

            if (!parentCategoryCombo) return dse;

            const parentIsCovid = _(categoryCombosMapping)
                .values()
                .includes(parentCategoryCombo.name);
            if (!parentIsCovid) return dse;

            const newCategoryCombo = getMappedCategoryCombo(dse.categoryCombo.id);
            if (!newCategoryCombo) return dse;

            const update: ItemUpdate = {
                dataSetId: dataSet.id,
                dataElementId: dataElementId,
                orgUnitId,
            };
            dataValueUpdate.push(update);
            const sp = dataSet.name.split(" ");
            changes.push({
                dataSet: sp.slice(0, sp.length - 1).join(" "),
                dataElement: dataElement.name,
            });

            return { ...dse, categoryCombo: { id: newCategoryCombo.id } };
        });

        return { ...dataSet, dataSetElements: dataSetElementsUpdated };
    });

    const dataSetsUpdated = _.differenceWith(dataSetsUpdated0, dataSets, _.isEqual);

    const changesGrouped = _(changes)
        .groupBy(o => o.dataSet)
        .mapValues(objs => _.uniq(objs.map(obj => obj.dataElement)))
        .value();

    writeDataFilePath("covid-datasets-changes.json", changesGrouped);
    writeDataFilePath(paths.dataSetsOrig, { dataSets: dataSets });
    writeDataFilePath(paths.dataSetsNew, { dataSets: dataSetsUpdated });

    return dataValueUpdate;
}

function getParentFn(config: Config) {
    const mapping = _(config.dataElements)
        .map(de => {
            const paired = _.first(de.pairedDataElements);
            return paired ? ([paired.id, de.id] as [Id, Id]) : null;
        })
        .compact()
        .fromPairs()
        .value();

    const dataElementsById = _.keyBy(config.dataElements, de => de.id);

    const getParent = (deId: Id) => {
        const parentId = _(mapping).get(deId, undefined);
        return parentId ? dataElementsById[parentId] : undefined;
    };
    return getParent;
}

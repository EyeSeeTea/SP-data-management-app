import _ from "lodash";
import parse from "parse-typed-args";
import { D2Api, DataValueSetsDataValue, Id, MetadataPick, Ref } from "../types/d2-api";
import { Config, getConfig } from "../models/Config";
import { getId, getRef } from "../utils/dhis2";
import { writeDataFilePath } from "./common";

/*
On 09/2020 we have introduced optional new-benefit disaggregation for Benefig indicators. When
a change of category combo for a data element is done, the existing projects are then outdated.

This script gets all datasets and checks that is's dataSetElements have a valid disaggregation
(the one fixed by the data element + optional COVID-19). For the non-match items, generate a
metadata payload with the data sets that need to be updated.
*/

const cocMapping: Record<CocId, CocId> = {
    default: "New",
    "COVID-19": "COVID-19, New",
    "Non-COVID-19": "Non-COVID-19, New",
};

async function main() {
    const parser = parse({
        opts: {
            url: {},
            postDataSets: { switch: true },
            postDataValues: { switch: true },
        },
    });
    const { opts } = parser(process.argv);

    const api = new D2Api({ baseUrl: opts.url });
    console.debug("Get config");
    const config = await getConfig(api);
    console.debug("Get metadata");
    const metadata = await getMetadata(api);

    const dataSetsUpdated = getFixedDataSets(metadata, config);
    console.debug(`Data sets to fix: ${dataSetsUpdated.length}`);
    const dataSetsPayload = { dataSets: dataSetsUpdated };
    writeDataFilePath("fix-disaggregation-datasets", dataSetsPayload);

    const fixedDataValues = await getFixedDataValues(api, config, metadata, dataSetsUpdated);
    console.debug(`Data values to fix: ${fixedDataValues.length / 2}`);
    writeDataFilePath("fix-disaggregation-datavalues", fixedDataValues);

    if (opts.postDataSets) {
        console.error(`POST datasets`);
        const res = await api.metadata.post(dataSetsPayload).getData();

        if (res.status !== "OK") {
            console.error(JSON.stringify(res, null, 4));
            throw new Error("Error on POST datasets");
        }
    }

    if (opts.postDataValues) {
        console.error(`POST data values`);
        const dataValuesPayload = { dataValues: fixedDataValues };
        const res = await api.dataValues.postSet({ force: true }, dataValuesPayload).getData();

        if (res.status !== "SUCCESS") {
            console.error(JSON.stringify(res, null, 4));
            throw new Error("Error on POST data values");
        }
    }
}

const yes = true as const;

const metadataQuery = {
    dataSets: {
        fields: {
            $owner: true,
            dataSetElements: {
                dataSet: { id: yes },
                dataElement: { id: yes },
                categoryCombo: { id: yes },
            },
        },
    },
    dataElements: {
        fields: {
            id: yes,
            code: yes,
            name: yes,
            categoryCombo: { id: yes, name: yes, categories: { id: yes } },
        },
    },
    categoryCombos: {
        fields: {
            id: yes,
            name: yes,
            categories: { id: yes },
            categoryOptionCombos: { id: yes },
        },
    },
    categoryOptionCombos: {
        fields: { id: yes, name: yes },
    },
};

type Metadata = MetadataPick<typeof metadataQuery>;
type CategoryCombo = Metadata["categoryCombos"][number];
type DataSet = Omit<Metadata["dataSets"][number], "dataSetElements"> & {
    dataSetElements: DataSetElement[];
};
type DataSetElement = Record<"dataSet" | "dataElement" | "categoryCombo", Ref>;

function getFixedDataSets(metadata: Metadata, config: Config) {
    return _.compact(
        metadata.dataSets.map(dataSet => {
            const dataSetElementsUpdated = dataSet.dataSetElements.map(dataSetElement => {
                return getDataSetElement(dataSet, dataSetElement, config, metadata);
            });
            const hasChanged = !_.isEqual(dataSet.dataSetElements, dataSetElementsUpdated);
            return hasChanged ? { ...dataSet, dataSetElements: dataSetElementsUpdated } : null;
        })
    );
}

function getMetadata(api: D2Api) {
    return api.metadata.get(metadataQuery).getData();
}

function getCategoryCombo(metadata: Metadata, dataSetElement: DataSetElement): CategoryCombo {
    return _(metadata.categoryCombos).keyBy(getId).getOrFail(dataSetElement.categoryCombo.id);
}

function getDataSetElement(
    dataSet: DataSet,
    dataSetElement: DataSetElement,
    config: Config,
    metadata: Metadata
): DataSetElement {
    const dataElementsById = _.keyBy(metadata.dataElements, getId);
    const dataElement = dataElementsById[dataSetElement.dataElement.id];
    const nonDefault = (category: Ref) => category.id !== config.categories.default.id;
    const dataSetElementCategories = getCategoryCombo(metadata, dataSetElement).categories.filter(
        nonDefault
    );
    const dataElementCategories = dataElement.categoryCombo.categories.filter(nonDefault);

    const areCategoriesForElementCorrect = _(dataSetElementCategories)
        .differenceBy([config.categories.covid19], getId)
        .isEqual(dataElementCategories);

    if (areCategoriesForElementCorrect) {
        return dataSetElement;
    } else {
        const isCodiv = (category: Ref) => category.id === config.categories.covid19.id;
        const hasCovidDisaggregation = _(dataSetElementCategories).some(isCodiv);
        const dataElementCategoriesWithoutCovid = _.reject(dataElementCategories, isCodiv);

        const categoriesFixed0 = hasCovidDisaggregation
            ? [getRef(config.categories.covid19), ...dataElementCategoriesWithoutCovid]
            : dataElementCategoriesWithoutCovid;

        const categoriesFixed = _.isEmpty(categoriesFixed0)
            ? [config.categories.default]
            : categoriesFixed0;

        const categoryComboFixed = metadata.categoryCombos.find(cc =>
            _.isEqual(cc.categories.map(getId), categoriesFixed.map(getId))
        );

        if (!categoryComboFixed) {
            const categoroyIds = categoriesFixed.map(getId).join(", ");
            const msg = `Could not find category combo containing categories: ${categoroyIds}`;
            throw new Error(msg);
        }

        console.log(
            `${dataSet.name}: dataElement (code=${dataElement.code}, catCombo=${dataElement.categoryCombo.name})` +
                `: ${getCategoryCombo(metadata, dataSetElement).name} -> ${categoryComboFixed.name}`
        );

        return { ...dataSetElement, categoryCombo: getRef(categoryComboFixed) };
    }
}

type CocId = Id;

async function getFixedDataValues(
    api: D2Api,
    config: Config,
    metadata: Metadata,
    dataSetsUpdated: DataSet[]
) {
    if (_.isEmpty(dataSetsUpdated)) return [];

    const dataSets = _(metadata.dataSets).keyBy(getId).at(dataSetsUpdated.map(getId)).value();

    const info = _(dataSets)
        .zip(dataSetsUpdated)
        .flatMap(([dataSet, dataSetUpdated]) => {
            if (!dataSet || !dataSetUpdated) throw new Error();
            return _.zip(dataSet.dataSetElements, dataSetUpdated.dataSetElements).map(
                ([dse, dseUpdated]) => {
                    if (!dse || !dseUpdated) throw new Error();
                    const isCatComboChanged = dse.categoryCombo.id === dseUpdated.categoryCombo.id;
                    if (isCatComboChanged) return null;

                    const orgUnitId = _(dataSet.attributeValues)
                        .map(av =>
                            av.attribute.id === config.attributes.orgUnitProject.id
                                ? av.value
                                : null
                        )
                        .compact()
                        .getOrFail(0);

                    const categoryComboFixed = getCategoryCombo(metadata, dseUpdated);
                    const cocIdsAvailable = categoryComboFixed.categoryOptionCombos.map(getId);
                    return {
                        orgUnit: { id: orgUnitId },
                        dataElement: dse.dataElement,
                        cocIdsAvailable,
                    };
                }
            );
        })
        .compact()
        .value();

    const cocIdByName = _(metadata.categoryOptionCombos)
        .map(coc => [coc.name, coc.id] as [string, Id])
        .fromPairs()
        .value();

    const mapping: Record<CocId, CocId> = _(cocMapping)
        .toPairs()
        .map(([fromCocName, toCocName]) => {
            return [_(cocIdByName).getOrFail(fromCocName), _(cocIdByName).getOrFail(toCocName)];
        })
        .fromPairs()
        .value();

    const { dataValues } = await api.dataValues
        .getSet({
            orgUnit: ["AGZEUf9meZ6"], // IHQ
            children: true,
            dataSet: dataSetsUpdated.map(getId),
            startDate: "1970",
            endDate: (new Date().getFullYear() + 1).toString(),
        })
        .getData();

    return _(dataValues)
        .flatMap((dataValue): DataValueSetsDataValue[] => {
            const matchingInfo = info.find(
                obj =>
                    dataValue.dataElement === obj.dataElement.id &&
                    dataValue.orgUnit === obj.orgUnit.id
            );
            if (!matchingInfo) return [];

            const cocId = dataValue.categoryOptionCombo;
            const newCocId = mapping[dataValue.categoryOptionCombo];
            const isCorrect = matchingInfo.cocIdsAvailable.includes(cocId);
            if (isCorrect) return [];

            if (!newCocId) {
                const infoS = JSON.stringify({ dataValue, matchingInfo }, null, 2);
                throw new Error(`There is no mapping for coc ${cocId} (${infoS})`);
            }

            const dataValueToDelete = { ...dataValue, deleted: true };
            const newDataValue = { ...dataValue, categoryOptionCombo: newCocId };
            return [dataValueToDelete, newDataValue];
        })
        .value();
}

main();

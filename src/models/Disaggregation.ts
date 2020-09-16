import _ from "lodash";
import { Id, Ref } from "../types/d2-api";
import { Config } from "./Config";
import { getRef, haveSameRefs, getIds } from "../utils/dhis2";
import DataElementsSet, { SelectionInfo } from "./dataElementsSet";

/* Custom disaggregation for data elements in target/actual data sets.

- If a data element is not selected as COVID-19, simply use its category combo.
- If a data element is selected as COVID-19:
    - Get its category combo and extract its categories.
    - Add the COVID-19 category to the set of categories.
    - Find a category combo that contains those categories.
    - Use that category combo as the disaggregation for this data element in the data set.
*/

interface Data {
    mapping: Record<Id, boolean>;
    dataElementsById: Record<Id, Config["dataElements"][0]>;
    categoryCombosById: Record<Id, Config["allCategoryCombos"][0]>;
}

interface DataSetElement {
    dataElement: Ref;
    categoryCombo?: Ref;
}

export type SetCovid19WithRelationsOptions = {
    dataElementsSet: DataElementsSet;
    sectorId: Id;
    dataElementIds: Id[];
    isSet: boolean;
};

export class Disaggregation {
    constructor(private config: Config, private data: Data) {}

    static getData(config: Config, mapping: Data["mapping"] = {}): Data {
        return {
            dataElementsById: _.keyBy(config.dataElements, de => de.id),
            categoryCombosById: _.keyBy(config.allCategoryCombos, cc => cc.id),
            mapping: mapping,
        };
    }

    static buildFromDataSetElements(config: Config, dataSetElements: DataSetElement[]) {
        const categoryCombosById = _.keyBy(config.categoryCombos, cc => cc.id);
        const covidMapping = _(dataSetElements)
            .map(dse => {
                const categoryCombo = dse.categoryCombo
                    ? categoryCombosById[dse.categoryCombo.id]
                    : null;
                const isCovid19 = categoryCombo
                    ? _(categoryCombo.categories).some(
                          category => category.id === config.categories.covid19.id
                      )
                    : false;
                return [dse.dataElement.id, isCovid19];
            })
            .fromPairs()
            .value();
        const data = this.getData(config, covidMapping);

        return new Disaggregation(config, data);
    }

    private getDefault(message: string): Ref {
        console.error(message);
        return getRef(this.config.categoryCombos.default);
    }

    getCategoryCombo(dataElementId: Id): Ref {
        const { config, data } = this;
        const isCovid19 = this.isCovid19(dataElementId);
        const dataElement = _(data.dataElementsById).get(dataElementId, null);
        const defaultCategory = this.config.categories.default;
        if (!dataElement) return this.getDefault(`Data element not found: ${dataElementId}`);

        const deCategoryCombo = _(data.categoryCombosById).get(dataElement.categoryCombo.id, null);
        if (!deCategoryCombo)
            return this.getDefault(`Category combo not found: ${dataElement.categoryCombo.id}`);

        if (!isCovid19) {
            return getRef(deCategoryCombo);
        } else {
            const categoriesWithCovid19 = _(deCategoryCombo.categories)
                .reject(category => category.id === defaultCategory.id)
                .concat([config.categories.covid19])
                .value();
            const categoryComboWithCovid19 = config.allCategoryCombos.find(cc =>
                haveSameRefs(cc.categories, categoriesWithCovid19)
            );
            if (!categoryComboWithCovid19)
                console.debug(`Category combo with covid19 not found: ${deCategoryCombo.id}`);

            return getRef(categoryComboWithCovid19 ? categoryComboWithCovid19 : deCategoryCombo);
        }
    }

    setCovid19(dataElementIds: Id[], isSet: boolean): Disaggregation {
        const mappingUpdate = _(dataElementIds)
            .filter(deId => _.has(this.data.dataElementsById, deId))
            .map(deId => [deId, isSet])
            .fromPairs()
            .value();
        const newData = { ...this.data, mapping: { ...this.data.mapping, ...mappingUpdate } };
        return new Disaggregation(this.config, newData);
    }

    isCovid19(dataElementId: Id): boolean {
        return !!this.data.mapping[dataElementId];
    }

    setCovid19WithRelations(
        options: SetCovid19WithRelationsOptions
    ): { selectionInfo: SelectionInfo; disaggregation: Disaggregation } {
        const { dataElementsSet, sectorId, dataElementIds, isSet } = options;
        const isCovid = this.isCovid19.bind(this);

        const selectedIds = dataElementsSet
            .get({ sectorId, onlySelected: true })
            .filter(de => (dataElementIds.includes(de.id) ? isSet : isCovid(de.id)))
            .map(de => de.id);

        const res = dataElementsSet.getSelectionInfo(selectedIds, sectorId, { filter: isCovid });
        const { selected, unselectable, selectionInfo } = res;

        const deIdsToUpdate = _(dataElementIds)
            .concat(getIds(selected))
            .difference(unselectable.map(de => de.id))
            .value();
        const newDisaggregation = this.setCovid19(deIdsToUpdate, isSet);

        return { selectionInfo, disaggregation: newDisaggregation };
    }
}

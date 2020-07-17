import _ from "lodash";
import { Id, Ref } from "../types/d2-api";
import { Config } from "./Config";
import { getRef, haveSameRefs } from "../utils/dhis2";

interface Data {
    mapping: Record<Id, boolean>;
    dataElementsById: Record<Id, Config["dataElements"][0]>;
    categoryCombosById: Record<Id, Config["allCategoryCombos"][0]>;
}

interface DataSetElement {
    dataElement: Ref;
    categoryCombo?: Ref;
}

export class Disaggregation {
    constructor(private config: Config, private data: Data) {}

    static build(config: Config, mapping: Data["mapping"] = {}) {
        const data = {
            dataElementsById: _.keyBy(config.dataElements, de => de.id),
            categoryCombosById: _.keyBy(config.allCategoryCombos, cc => cc.id),
            mapping: mapping,
        };
        return new Disaggregation(config, data);
    }

    static buildFromDataSetElements(config: Config, dataSetElements: DataSetElement[]) {
        const categoryCombosById = _.keyBy(config.categoryCombos, cc => cc.id);
        const covidMapping = _(dataSetElements)
            .map(dse => {
                const categoryCombo = dse.categoryCombo
                    ? categoryCombosById[dse.categoryCombo.id]
                    : null;
                const isCovid19 = categoryCombo
                    ? _(categoryCombo.categories || []).some(
                          category => category.id === config.categories.covid19.id
                      )
                    : false;
                return [dse.dataElement.id, isCovid19];
            })
            .fromPairs()
            .value();

        return Disaggregation.build(config, covidMapping);
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
            return categoryComboWithCovid19
                ? getRef(categoryComboWithCovid19)
                : this.getDefault(
                      `Category combo related with covid19 not found: ${deCategoryCombo.id}`
                  );
        }
    }

    setCovid19(dataElementIds: Id[], isSet: boolean): Disaggregation {
        const update = _(dataElementIds)
            .filter(deId => _.has(this.data.dataElementsById, deId))
            .map(deId => [deId, isSet])
            .fromPairs()
            .value();
        const newData = { ...this.data, mapping: { ...this.data.mapping, ...update } };
        return new Disaggregation(this.config, newData);
    }

    isCovid19(dataElementId: Id): boolean {
        return !!this.data.mapping[dataElementId];
    }
}

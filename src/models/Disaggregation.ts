import _ from "lodash";
import { Id, Ref } from "../types/d2-api";
import { Config } from "./Config";

interface CategoryCombo {
    id: Id;
    name: string;
}

interface Data {
    mapping: Record<Id, boolean>;
    dataElementsById: Record<Id, Config["dataElements"][0]>;
}

export class Disaggregation {
    constructor(private config: Config, private data: Data) {}

    static build(config: Config, mapping: Data["mapping"] = {}) {
        const data = {
            dataElementsById: _.keyBy(config.dataElements, de => de.id),
            mapping: mapping,
        };
        return new Disaggregation(config, data);
    }

    getCategoryCombo(dataElementId: Id): Ref {
        const { categoryCombos } = this.config;
        const categoryCombo = this.isCovid19(dataElementId)
            ? categoryCombos.genderNewRecurringCovid19
            : categoryCombos.genderNewRecurring;
        return { id: categoryCombo.id };
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

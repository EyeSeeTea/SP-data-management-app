import _ from "lodash";
import { D2Api, D2CategoryCombo } from "../../types/d2-api";
import { getRef, getUid } from "../../utils/dhis2";
import { Debug, Migration } from "../types";
import { error, post } from "./common";

class AddBenefitsDisaggregationMigration {
    constructor(private api: D2Api, private debug: Debug) {}

    async execute() {
        await this.createDisaggregatedCategoryCombosForBenefits();
    }

    async createDisaggregatedCategoryCombosForBenefits() {
        this.debug("Get categories");

        const { categories } = await this.api.metadata
            .get({
                categories: {
                    fields: {
                        id: true,
                        code: true,
                        categoryOptions: { id: true, code: true },
                    },
                },
            })
            .getData();

        const [categoryCovid19, categoryNewReturning] = _(categories)
            .keyBy(category => category.code)
            .at(["COVID19", "NEW_RETURNING"])
            .value();

        if (!categoryCovid19 || !categoryNewReturning) error("Expected categories not found");

        const payload = {
            categoryCombos: [
                {
                    id: getUid("category", "new-returning"),
                    name: "New-Returning",
                    code: "NEW_RETURNING",
                    dataDimensionType: "DISAGGREGATION",
                    categories: [categoryNewReturning].map(getRef),
                } as Partial<D2CategoryCombo>,
                {
                    id: getUid("category", "covid-new-returning"),
                    name: "COVID-19/New-Returning",
                    code: "COVID19_NEW_RETURNING",
                    dataDimensionType: "DISAGGREGATION",
                    categories: [categoryCovid19, categoryNewReturning].map(getRef),
                } as Partial<D2CategoryCombo>,
            ],
        };

        this.debug("Post new category combos");

        await post(this.api, this.debug, payload);

        this.debug("Update category option combos");
        await this.api.maintenance.categoryOptionComboUpdate().getData();
    }
}

const migration: Migration = {
    name: "Created category combos New/Returning for Benefit indicators",
    migrate: async (api: D2Api, debug: Debug) =>
        new AddBenefitsDisaggregationMigration(api, debug).execute(),
};

export default migration;

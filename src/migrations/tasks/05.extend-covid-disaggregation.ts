import { D2Api } from "../../types/d2-api";
import { getUid } from "../../utils/dhis2";
import { Debug, Migration } from "../types";
import { error, post } from "./common";

class ExtendCovidDisaggregation {
    constructor(private api: D2Api, private debug: Debug) {}

    async execute() {
        await this.updateCategoryOptions();
    }

    async updateCategoryOptions() {
        const { categories, categoryOptions } = await this.api.metadata
            .get({
                categories: {
                    fields: { $owner: true },
                    filter: { code: { eq: "COVID19" } },
                },
                categoryOptions: {
                    fields: { $owner: true },
                    filter: { code: { eq: "COVID19" } },
                },
            })
            .getData();

        const categoryCovid = categories[0];
        if (!categoryCovid) error("COVID category not found");

        const categoryOptionCovid = categoryOptions[0];
        if (!categoryOptionCovid) error("COVID category option not found");

        const categoryOptionNonCovid = {
            id: getUid("categoryOptions", "covid-no"),
            name: "Non-COVID-19",
            code: "COVID19_NO",
        };

        this.debug(`Covid category: ${categoryCovid.id}`);
        this.debug(`Covid category option: ${categoryOptionCovid.id}`);

        const categoryCovidUpdated = {
            ...categoryCovid,
            categoryOptions: [{ id: categoryOptionCovid.id }, { id: categoryOptionNonCovid.id }],
        };

        this.debug(`Add category option: ${categoryOptionNonCovid.name}`);

        const res = await post(this.api, this.debug, {
            categories: [categoryCovidUpdated],
            categoryOptions: [categoryOptionNonCovid],
        });

        console.debug(res);

        this.debug("Update category option combos");
        await this.api.maintenance.categoryOptionComboUpdate().getData();
    }
}

const migration: Migration = {
    name: "Extend COVID-19 disaggregation",
    migrate: async (api: D2Api, debug: Debug) =>
        new ExtendCovidDisaggregation(api, debug).execute(),
};

export default migration;

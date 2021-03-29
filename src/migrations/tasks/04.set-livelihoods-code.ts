import { D2Api } from "../../types/d2-api";
import { Debug, Migration } from "../types";
import { post } from "./common";

class FixLivelihoodsCode {
    constructor(private api: D2Api, private debug: Debug) {}

    async execute() {
        await this.createUserRole();
    }

    async createUserRole() {
        const { sections: sections, options } = await this.api.metadata
            .get({
                sections: {
                    fields: { $owner: true },
                    filter: { code: { $ilike: "SECTOR\\_LIVELIHOOD\\_" } },
                },
                options: {
                    fields: { $owner: true },
                    filter: { code: { eq: "SECTOR_LIVELIHOOD" } },
                },
            })
            .getData();

        const newSections = sections.map(section => ({
            ...section,
            code: section.code.replace("SECTOR_LIVELIHOOD_", "SECTOR_LIVELIHOODS_"),
        }));

        const newOptions = options.map(option => ({
            ...option,
            code: "SECTOR_LIVELIHOODS",
        }));

        console.debug({ sections: newSections.length, options: newOptions.length });

        const res = await post(this.api, this.debug, {
            sections: newSections,
            options: newOptions,
        });

        console.debug(res);
    }
}

const migration: Migration = {
    name: "Fix Livehoods code",
    migrate: async (api: D2Api, debug: Debug) => new FixLivelihoodsCode(api, debug).execute(),
};

export default migration;

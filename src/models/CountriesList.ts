import { D2Api } from "../types/d2-api";
import { PaginatedObjects, Paging, Sorting } from "./PaginatedObjects";
import { Config } from "./Config";
import User, { OrganisationUnit } from "./user";

export interface Country {
    id: string;
    name: string;
    code: string;
    projectsCount: number;
    created: Date;
    lastUpdated: Date;
}

const countryFieldToOrderField: Partial<Record<keyof Country, keyof OrganisationUnit>> = {
    name: "displayName",
};

export class CountriesList {
    currentUser: User;
    countries: OrganisationUnit[];

    constructor(private api: D2Api, private config: Config) {
        this.currentUser = new User(config);
        this.countries = this.currentUser.getCountries();
    }

    async get(
        search: string,
        paging: Paging,
        sorting: Sorting<Country>
    ): Promise<PaginatedObjects<Country>> {
        const orderField = countryFieldToOrderField[sorting.field] || sorting.field;
        const metadata$ = this.api.models.organisationUnits.get({
            fields: {
                id: true,
                displayName: true,
                code: true,
                created: true,
                lastUpdated: true,
                name: { $fn: { name: "rename", to: "abc" } } as const,
                children: { $fn: { name: "size" } } as const,
            },
            filter: {
                id: { in: this.countries.map(ou => ou.id) },
                ...(search ? { name: { ilike: search } } : {}),
            },
            paging: true,
            ...paging,
            order: `${orderField}:i${sorting.order}`,
        });
        const { pager, objects: orgUnits } = await metadata$.getData();

        const countries: Country[] = orgUnits.map(orgUnit => ({
            id: orgUnit.id,
            name: orgUnit.displayName,
            code: orgUnit.code,
            projectsCount: orgUnit.children,
            created: new Date(orgUnit.created),
            lastUpdated: new Date(orgUnit.lastUpdated),
        }));

        return { pager, objects: countries };
    }
}

import { D2Api } from "../types/d2-api";
import _ from "lodash";
import { PaginatedObjects, Paging, Sorting } from "./PaginatedObjects";
import { Config } from "./Config";
import User, { OrganisationUnit } from "./user";
import { paginate } from "../utils/pagination";

export interface Country {
    id: string;
    name: string;
    code: string;
    projectsCount: number;
    created: Date;
    lastUpdated: Date;
}

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
        const metadata$ = this.api.models.organisationUnits.get({
            paging: false,
            fields: {
                id: true,
                displayName: true,
                code: true,
                created: true,
                lastUpdated: true,
                children: { $fn: { name: "size" } } as const,
            },
            filter: {
                id: { in: this.countries.map(ou => ou.id) },
            },
        });
        const { objects: allOrgUnits } = await metadata$.getData();
        const { pager, objects: orgUnits } = paginate(allOrgUnits, paging);
        const searchLower = toKey(search);

        const orgUnitsFiltered = orgUnits.filter(
            orgUnit =>
                toKey(orgUnit.displayName).includes(searchLower) ||
                toKey(orgUnit.code).includes(searchLower)
        );

        const countries: Country[] = orgUnitsFiltered.map(orgUnit => ({
            id: orgUnit.id,
            name: orgUnit.displayName,
            code: orgUnit.code,
            projectsCount: orgUnit.children,
            created: new Date(orgUnit.created),
            lastUpdated: new Date(orgUnit.lastUpdated),
        }));

        const countriesSorted = _.orderBy(
            countries,
            [country => country[sorting.field]],
            [sorting.order]
        );
        return { pager, objects: countriesSorted };
    }
}

function toKey(s: string | undefined): string {
    return s ? s.toLocaleLowerCase() : "";
}

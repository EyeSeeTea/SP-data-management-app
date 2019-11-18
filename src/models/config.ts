import { D2Api, Id } from "d2-api";

export const baseConfig = {
    userRoles: {
        feedback: ["PM Feedback"],
        reportingAnalyst: ["PM Reporting Analyst"],
        superUser: ["PM Superuser"],
        encode: ["PM Encoder"],
        analyser: ["PM Analyser"],
    },
};

export type Config = typeof baseConfig & {
    currentUser: {
        id: Id;
        userRoles: Array<{ name: string }>;
        organisationUnits: Array<{
            id: Id;
            displayName: string;
        }>;
    };
};

class ConfigLoader {
    constructor(public api: D2Api) {}

    async get(): Promise<Config> {
        const currentUser = await this.api.currrentUser
            .get({
                fields: {
                    id: true,
                    displayName: true,
                    userCredentials: { userRoles: { name: true } },
                    organisationUnits: { id: true, displayName: true },
                },
            })
            .getData();

        return {
            ...baseConfig,
            currentUser: {
                id: currentUser.id,
                userRoles: currentUser.userCredentials.userRoles,
                organisationUnits: currentUser.organisationUnits,
            },
        };
    }
}

export async function getConfig(api: D2Api): Promise<Config> {
    return new ConfigLoader(api).get();
}

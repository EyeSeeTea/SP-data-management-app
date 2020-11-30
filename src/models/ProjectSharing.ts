import { OrganisationUnit } from "./Project";
import _ from "lodash";
import { Config } from "./Config";
import { D2DataSetSchema, Ref } from "../types/d2-api";
import {
    Sharing,
    EntityAccess,
    D2SharingUpdate,
    mergeSharing,
    D2Sharing,
    getD2EntitiesAccess,
    fullAccess,
    fullMetadataAccess,
    getEntitiesAccess,
    emptySharing,
} from "./Sharing";
import { Maybe } from "../types/utils";

export interface ProjectForSharing {
    id: string;
    sharing: Sharing;
    parentOrgUnit: Maybe<Ref>;
}

export default class ProjectSharing {
    constructor(private config: Config, public project: ProjectForSharing) {}

    static getInitialSharing(config: Config): Sharing {
        const { currentUser, userGroups } = config;
        const userAccesses: EntityAccess[] = [
            { id: currentUser.id, name: currentUser.displayName },
        ];
        const systemAdminGroup = _(userGroups).get(config.base.userGroups.systemAdmin, null);
        const appAdminGroup = _(userGroups).get(config.base.userGroups.appAdmin, null);
        const userGroupAccesses: EntityAccess[] = _.compact([
            systemAdminGroup && { id: systemAdminGroup.id, name: systemAdminGroup.displayName },
            appAdminGroup && { id: appAdminGroup.id, name: appAdminGroup.displayName },
        ]);

        return { userAccesses, userGroupAccesses };
    }

    getBaseSharing(): Sharing {
        const { config, project } = this;
        const initialSharing = ProjectSharing.getInitialSharing(config);
        const countrySharing = project.parentOrgUnit
            ? this.getSharingForCountry(project.parentOrgUnit)
            : emptySharing;
        return mergeSharing(initialSharing, countrySharing);
    }

    getBaseSharingIds(): Set<string> {
        const baseSharing = this.getBaseSharing();
        return new Set(
            _(baseSharing.userAccesses)
                .concat(baseSharing.userGroupAccesses)
                .map(access => access.id)
                .value()
        );
    }

    getSharingAttributesForDataSets(): D2Sharing {
        const { userAccesses, userGroupAccesses } = this.project.sharing;

        return {
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: getD2EntitiesAccess(userAccesses, fullAccess),
            userGroupAccesses: getD2EntitiesAccess(userGroupAccesses, fullAccess),
        };
    }

    getSharingAttributesForDashboard(): D2Sharing {
        const { userAccesses, userGroupAccesses } = this.project.sharing;

        return {
            publicAccess: "--------",
            externalAccess: false,
            userAccesses: getD2EntitiesAccess(userAccesses, fullMetadataAccess),
            userGroupAccesses: getD2EntitiesAccess(userGroupAccesses, fullMetadataAccess),
        };
    }

    getSharedObject() {
        const { project } = this;

        return {
            meta: {
                allowPublicAccess: false,
                allowExternalAccess: false,
            },
            object: {
                id: project.id,
                publicAccess: "--------",
                externalAccess: false,
                userAccesses: getD2EntitiesAccess(project.sharing.userAccesses, fullAccess),
                userGroupAccesses: getD2EntitiesAccess(
                    project.sharing.userGroupAccesses,
                    fullAccess
                ),
            },
        };
    }

    getSharingFromD2Update(d2SharingUpdate: D2SharingUpdate): Sharing {
        const { userAccesses, userGroupAccesses } = d2SharingUpdate;
        const newSharing: Sharing = {
            ...this.project.sharing,
            ...(userAccesses ? { userAccesses: getEntitiesAccess(userAccesses) } : {}),
            ...(userGroupAccesses
                ? { userGroupAccesses: getEntitiesAccess(userGroupAccesses) }
                : {}),
        };
        return newSharing;
    }

    getUpdatedSharingForCountry(country: OrganisationUnit | undefined): Sharing {
        const { config, project } = this;
        const currentSharing = project.sharing;
        const countrySharing = this.getSharingForCountry(country);

        const userGroupCodesById = _(config.userGroups)
            .map(userGroup => [userGroup.id, userGroup.code] as [string, string])
            .fromPairs()
            .value();

        const userGroupAccessesWithoutCountries = _(currentSharing.userGroupAccesses)
            .reject(userGroupAccess => {
                const code = userGroupCodesById[userGroupAccess.id];
                return !!code && code.startsWith(config.base.userGroups.countryAdminPrefix);
            })
            .value();

        const sharingWithoutCountries: Sharing = {
            userAccesses: currentSharing.userAccesses,
            userGroupAccesses: userGroupAccessesWithoutCountries,
        };

        return mergeSharing(sharingWithoutCountries, countrySharing);
    }

    getSharingForCountry(country: Ref | undefined): Sharing {
        const { config } = this;
        const configCountry = country ? config.countries.find(c => c.id === country.id) : null;
        const userGroupCode = configCountry ? "ADMIN_" + configCountry.code : null;
        const userGroup = userGroupCode ? _(config.userGroups).get(userGroupCode, null) : null;
        const groupAccesses = userGroup ? [{ id: userGroup.id, name: userGroup.displayName }] : [];
        return { userAccesses: [], userGroupAccesses: groupAccesses };
    }
}

type D2DataSetAccess = D2DataSetSchema["fields"]["access"] & {
    data?: { read: boolean; write: boolean }; // Currently not in d2-api, add manually
};

export function hasCurrentUserFullAccessToDataSet(shareable: { access: D2DataSetAccess }): boolean {
    const { access } = shareable;
    const metadataAccess = access.read && access.write;
    const dataAccess = access.data ? access.data.read && access.data.write : true;
    return metadataAccess && dataAccess;
}

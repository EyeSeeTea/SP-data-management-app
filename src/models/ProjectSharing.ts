import Project, { OrganisationUnit } from "./Project";
import _ from "lodash";
import { Config } from "./Config";

type D2Access = string;

export interface D2Sharing {
    publicAccess: D2Access;
    externalAccess: boolean;
    userAccesses: D2EntityAccess[];
    userGroupAccesses: D2EntityAccess[];
}

type D2SharingUpdate = Partial<D2Sharing>;

export interface D2EntityAccess {
    access: D2Access;
    displayName: string;
    id: string;
}

export interface Sharing {
    userAccesses: EntityAccess[];
    userGroupAccesses: EntityAccess[];
}

export interface EntityAccess {
    id: string;
    name: string;
}

export interface Access {
    meta: { read: boolean; write: boolean };
    data?: { read: boolean; write: boolean };
}

const fullAccess: Access = {
    meta: { read: true, write: true },
    data: { read: true, write: true },
};

const fullMetadataAccess: Access = {
    meta: { read: true, write: true },
};

export default class ProjectSharing {
    constructor(public project: Project) {}

    static getInitialSharing(config: Config): Sharing {
        const systemAdminGroup = _(config.userGroups).get(config.base.userGroups.systemAdmin, null);
        const appAdminGroup = _(config.userGroups).get(config.base.userGroups.appAdmin, null);
        const userGroupAccesses: EntityAccess[] = _.compact([
            systemAdminGroup && { id: systemAdminGroup.id, name: systemAdminGroup.displayName },
            appAdminGroup && { id: appAdminGroup.id, name: appAdminGroup.displayName },
        ]);

        return { userAccesses: [], userGroupAccesses };
    }

    getBaseSharing(): Sharing {
        const { project } = this;
        const initialSharing = ProjectSharing.getInitialSharing(project.config);
        const countrySharing = this.getSharingForCountry(project.parentOrgUnit);
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
                displayName: project.name,
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

    getProjectFromD2Update(d2SharingUpdate: D2SharingUpdate): Project {
        const { userAccesses, userGroupAccesses } = d2SharingUpdate;
        const newSharing: Sharing = {
            ...this.project.sharing,
            ...(userAccesses ? { userAccesses: getEntitiesAccess(userAccesses) } : {}),
            ...(userGroupAccesses
                ? { userGroupAccesses: getEntitiesAccess(userGroupAccesses) }
                : {}),
        };
        return this.project.setObj({ sharing: newSharing });
    }

    getUpdatedSharingForCountry(country: OrganisationUnit | undefined): Sharing {
        const { config } = this.project;
        const currentSharing = this.project.sharing;
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

    getSharingForCountry(country: OrganisationUnit | undefined): Sharing {
        const { config } = this.project;
        const configCountry = country ? config.countries.find(c => c.id === country.id) : null;
        const userGroupCode = configCountry ? "ADMIN_" + configCountry.code : null;
        const userGroup = userGroupCode ? _(config.userGroups).get(userGroupCode, null) : null;
        const groupAccesses = userGroup ? [{ id: userGroup.id, name: userGroup.displayName }] : [];
        return { userAccesses: [], userGroupAccesses: groupAccesses };
    }
}

function getD2EntitiesAccess(entitySharings: EntityAccess[], access: Access): D2EntityAccess[] {
    return entitySharings.map(entitySharing => ({
        id: entitySharing.id,
        displayName: entitySharing.name,
        access: getD2Access(access),
    }));
}

function getD2Access(d2Access: Access): D2Access {
    const parts = [
        d2Access.meta.read ? "r" : "-",
        d2Access.meta.write ? "w" : "-",
        d2Access.data && d2Access.data.read ? "r" : "-",
        d2Access.data && d2Access.data.write ? "w" : "-",
    ];
    return parts.join("") + "----";
}

function getEntitiesAccess(d2EntitySharings: D2EntityAccess[]): EntityAccess[] {
    return d2EntitySharings.map(d2EntitySharing => ({
        id: d2EntitySharing.id,
        name: d2EntitySharing.displayName,
    }));
}

export function getSharing(object: D2Sharing): Sharing {
    const userAccesses = getEntitiesAccess(object.userAccesses);
    const userGroupAccesses = getEntitiesAccess(object.userGroupAccesses);
    return { userAccesses, userGroupAccesses };
}

export function getAccessFromD2Access(d2Access: D2Access): Access {
    const [metaRead, metaWrite, dataRead, dataWrite] = d2Access.slice(0, 4).split("");
    return {
        meta: { read: metaRead === "r", write: metaWrite === "w" },
        data: { read: dataRead === "r", write: dataWrite === "w" },
    };
}

export function mergeSharing(sharing1: Sharing, sharing2: Sharing): Sharing {
    const userAccesses = _(sharing1.userAccesses)
        .concat(sharing2.userAccesses)
        .uniqBy(sharing => sharing.id)
        .value();

    const userGroupAccesses = _(sharing1.userGroupAccesses)
        .concat(sharing2.userGroupAccesses)
        .uniqBy(sharing => sharing.id)
        .value();

    return { userAccesses, userGroupAccesses };
}

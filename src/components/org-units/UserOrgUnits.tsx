import React, { useEffect, useState } from "react";
import _ from "lodash";
import { OrgUnitsSelector, useSnackbar } from "d2-ui-components";
import { LinearProgress } from "@material-ui/core";
import { useAppContext } from "../../contexts/api-context";
import User from "../../models/user";
import i18n from "../../locales";
import { getIdFromOrgUnit } from "../../utils/dhis2";
import { D2Api } from "d2-api";

type Path = string;

interface UserOrgUnitsProps {
    onChange: (orgUnit: OrganisationUnit) => void;
    selected: { path: Path } | null | undefined;
    selectableLevels?: number[];
    withElevation?: boolean;
    height?: number;
}

const controls = {
    filterByLevel: false,
    filterByGroup: false,
    selectAll: false,
};

interface OrganisationUnit {
    id: string;
    path: string;
    displayName: string;
}

async function getOrganisationUnit(
    api: D2Api,
    path: string
): Promise<OrganisationUnit | undefined> {
    const { objects } = await api.models.organisationUnits
        .get({
            fields: { displayName: true },
            filter: { path: { eq: path } },
        })
        .getData();

    return objects.length > 0 ? { ...objects[0], path, id: getIdFromOrgUnit({ path }) } : undefined;
}

const UserOrgUnits: React.FC<UserOrgUnitsProps> = props => {
    const [rootIds, setRootIds] = useState<string[]>([]);
    const snackbar = useSnackbar();
    const { d2, api, config } = useAppContext();
    const user = new User(config);
    const { onChange, selected, selectableLevels, withElevation = true, height } = props;

    useEffect(() => {
        const rootIds = user.getOrgUnits().map(ou => ou.id);
        if (_(rootIds).isEmpty()) {
            snackbar.error(
                i18n.t("This user has no Data output and analytic organisation units assigned")
            );
        } else {
            setRootIds(rootIds);
        }
    }, [d2]);

    async function onChangeOu(orgUnitPaths: string[]) {
        const lastSelectedPath = _.last(orgUnitPaths);
        const orgUnit = lastSelectedPath ? await getOrganisationUnit(api, lastSelectedPath) : null;
        if (orgUnit) onChange(orgUnit);
    }

    return (
        <div>
            {rootIds.length > 0 ? (
                <OrgUnitsSelector
                    d2={d2}
                    onChange={onChangeOu}
                    selected={selected ? [selected.path] : undefined}
                    selectableLevels={selectableLevels}
                    controls={controls}
                    rootIds={rootIds}
                    withElevation={withElevation}
                    typeInput="radio"
                    height={height}
                />
            ) : (
                <LinearProgress />
            )}
        </div>
    );
};

export default UserOrgUnits;

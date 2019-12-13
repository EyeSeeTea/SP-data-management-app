import React, { useEffect, useState } from "react";
import _ from "lodash";
import { OrgUnitsSelector, useSnackbar } from "d2-ui-components";
import { LinearProgress } from "@material-ui/core";
import { useAppContext } from "../../contexts/api-context";
import User from "../../models/user";
import i18n from "../../locales";

type Path = string;

interface UserOrgUnitsProps {
    onChange: (orgUnitPaths: Path[]) => void;
    selected: Path[];
    selectableLevels?: number[];
}

const controls = {
    filterByLevel: false,
    filterByGroup: false,
    selectAll: false,
};

const UserOrgUnits: React.FC<UserOrgUnitsProps> = props => {
    const [rootIds, setRootIds] = useState<string[]>([]);
    const snackbar = useSnackbar();
    const { d2, config } = useAppContext();
    const user = new User(config);
    const { onChange, selected, selectableLevels } = props;

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

    return (
        <div>
            {rootIds.length > 0 ? (
                <OrgUnitsSelector
                    d2={d2}
                    onChange={onChange}
                    selected={selected}
                    selectableLevels={selectableLevels}
                    controls={controls}
                    rootIds={rootIds}
                    typeInput="radio"
                />
            ) : (
                <LinearProgress />
            )}
        </div>
    );
};

export default UserOrgUnits;

import React, { useEffect, useState } from "react";
import _ from "lodash";
import { OrgUnitsSelector, useSnackbar } from "d2-ui-components";
import { LinearProgress } from "@material-ui/core";

import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import i18n from "../../../locales";
import { useAppContext } from "../../../contexts/api-context";
import User from "../../../models/user";

const controls = {
    filterByLevel: true,
    filterByGroup: true,
    selectAll: true,
};

const OrgUnitsStep: React.FC<StepProps> = ({ project, onChange }) => {
    const [rootIds, setRootIds] = useState<string[]>([]);
    const snackbar = useSnackbar();
    const { d2, config } = useAppContext();
    const user = new User(config);

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

    const setOrgUnits = (orgUnitsPaths: string[]) => {
        const orgUnits = orgUnitsPaths.map(path => ({ path }));
        const newProject = project.set("organisationUnits", orgUnits);
        onChange(newProject);
    };

    return (
        <React.Fragment>
            {rootIds.length > 0 ? (
                <OrgUnitsSelector
                    d2={d2}
                    onChange={setOrgUnits}
                    selected={project.organisationUnits.map(ou => ou.path)}
                    controls={controls}
                    rootIds={rootIds}
                />
            ) : (
                <LinearProgress />
            )}
        </React.Fragment>
    );
};

export default OrgUnitsStep;

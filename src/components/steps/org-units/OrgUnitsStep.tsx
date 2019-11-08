import React, { useEffect, useState } from "react";
import _ from "lodash";
import { OrgUnitsSelector, useSnackbar } from "d2-ui-components";
import { D2Api } from "d2-api";

import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import i18n from "../../../locales";
import { useD2 } from "../../../contexts/api-context";
import { LinearProgress } from "@material-ui/core";

const controls = {
    filterByLevel: true,
    filterByGroup: true,
    selectAll: true,
};

async function getCurrentUserOrganisationUnitsRoot(api: D2Api): Promise<string[]> {
    const currentUser = await api.currrentUser.get().getData();
    return currentUser.organisationUnits.map(ou => ou.id);
}

const OrgUnitsStep: React.FC<StepProps> = ({ api, project, onChange }) => {
    const [rootIds, setRootIds] = useState<string[]>([]);
    const snackbar = useSnackbar();
    const d2 = useD2();

    useEffect(() => {
        async function load() {
            const rootIds = await getCurrentUserOrganisationUnitsRoot(api);
            if (_(rootIds).isEmpty()) {
                snackbar.error(
                    i18n.t("This user has no Data output and analytic organisation units assigned")
                );
            } else {
                setRootIds(rootIds);
            }
        }
        load();
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
                    levels={[1, 2, 3]}
                    selectableLevels={[1, 2, 3]}
                />
            ) : (
                <LinearProgress />
            )}
        </React.Fragment>
    );
};

export default OrgUnitsStep;

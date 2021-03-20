import React from "react";
import { makeStyles } from "@material-ui/core/styles";

import i18n from "../../../locales";
import { D2Api } from "../../../types/d2-api";
import { Sharing, ShareUpdate } from "@eyeseetea/d2-ui-components";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import ProjectSharing from "../../../models/ProjectSharing";
import Project from "../../../models/Project";
import { useAppContext } from "../../../contexts/api-context";

const showOptions = {
    title: false,
    dataSharing: true,
    publicSharing: false,
    externalSharing: false,
    permissionPicker: false,
};

function searchUsers(api: D2Api, query: string, project: Project) {
    const countryId = project.parentOrgUnit ? project.parentOrgUnit.id : undefined;
    const userOptions = {
        fields: { id: true, displayName: true },
        filter: {
            displayName: { ilike: query },
            ...(countryId ? { "organisationUnits.id": { eq: countryId } } : {}),
        },
    };
    const userGroupOptions = {
        fields: { id: true, displayName: true },
        filter: { displayName: { ilike: query } },
    };
    return api.metadata.get({ users: userOptions, userGroups: userGroupOptions }).getData();
}

const SharingStep: React.FC<StepProps> = props => {
    const { config } = useAppContext();
    const { api, project, onChange } = props;
    const projectSharing = React.useMemo(() => {
        return new ProjectSharing(config, project);
    }, [config, project]);
    const sharedObject = React.useMemo(() => projectSharing.getSharedObject(), [projectSharing]);
    const setProjectSharing = React.useCallback(
        (shareUpdate: ShareUpdate) => {
            const newSharing = projectSharing.getSharingFromD2Update(shareUpdate);
            const newProject = project.setObj({ sharing: newSharing });
            onChange(newProject);
            return Promise.resolve();
        },
        [project, projectSharing, onChange]
    );
    const search = React.useCallback((query: string) => searchUsers(api, query, project), [
        api,
        project,
    ]);

    const classes = useStyles();

    const unremovableIds = React.useMemo(() => {
        return projectSharing.getBaseSharingIds();
    }, [projectSharing]);

    const country = project.parentOrgUnit?.displayName || "-";

    return (
        <div data-cy="sharing">
            <Sharing
                meta={sharedObject}
                showOptions={showOptions}
                onSearch={search}
                onChange={setProjectSharing}
                unremovebleIds={unremovableIds}
            />

            <div className={classes.footer}>
                {i18n.t(
                    "Note: only users with permissions in the selected country ({{country}}) can be added to this project",
                    { nsSeparator: false, country }
                )}
            </div>
        </div>
    );
};

const useStyles = makeStyles({
    footer: { marginTop: 10, marginBottom: 15, fontSize: "1.1em", textAlign: "right" },
});

export default React.memo(SharingStep);

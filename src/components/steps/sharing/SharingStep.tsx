import React from "react";
import { makeStyles } from "@material-ui/core/styles";

import i18n from "../../../locales";
import { D2Api } from "../../../types/d2-api";
import { Sharing, ShareUpdate } from "d2-ui-components";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import ProjectSharing from "../../../models/ProjectSharing";
import Project from "../../../models/Project";

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
    const { api, project, onChange } = props;
    const projectSharing = React.useMemo(() => new ProjectSharing(project), [project]);
    const sharedObject = React.useMemo(() => projectSharing.getSharedObject(), [projectSharing]);
    const setProjectSharing = React.useCallback(
        (shareUpdate: ShareUpdate) => {
            const newProject = projectSharing.getProjectFromD2Update(shareUpdate);
            onChange(newProject);
            return Promise.resolve();
        },
        [projectSharing, onChange]
    );
    const search = React.useCallback((query: string) => searchUsers(api, query, project), [api]);

    const classes = useStyles();

    const unremovebleIds = React.useMemo(() => {
        return projectSharing.getBaseSharingIds();
    }, [projectSharing]);

    return (
        <React.Fragment>
            <Sharing
                meta={sharedObject}
                showOptions={showOptions}
                onSearch={search}
                onChange={setProjectSharing}
                unremovebleIds={unremovebleIds}
            />

            <div className={classes.footer}>
                {i18n.t(
                    "Note: only users with permissions in the selected country ({{country}}) can be added to this project",
                    { country: project.parentOrgUnit?.displayName }
                )}
            </div>
        </React.Fragment>
    );
};

const useStyles = makeStyles({
    footer: { marginTop: 10, marginBottom: 15, fontSize: "1.1em", textAlign: "right" },
});

export default React.memo(SharingStep);

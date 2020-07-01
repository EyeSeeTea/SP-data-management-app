import React from "react";
import { D2Api } from "../../../types/d2-api";
import { Sharing, ShareUpdate } from "d2-ui-components";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import ProjectSharing from "../../../models/ProjectSharing";

const showOptions = {
    dataSharing: true,
    publicSharing: false,
    externalSharing: false,
    permissionPicker: false,
};

function searchUsers(api: D2Api, query: string) {
    const options = {
        fields: { id: true, displayName: true },
        filter: { displayName: { ilike: query } },
    };
    return api.metadata.get({ users: options, userGroups: options }).getData();
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
    const search = React.useCallback((query: string) => searchUsers(api, query), [api]);

    const unremovebleIds = React.useMemo(() => {
        return projectSharing.getBaseSharingIds();
    }, [projectSharing]);

    return (
        <Sharing
            meta={sharedObject}
            showOptions={showOptions}
            onSearch={search}
            onChange={setProjectSharing}
            unremovebleIds={unremovebleIds}
        />
    );
};

export default React.memo(SharingStep);

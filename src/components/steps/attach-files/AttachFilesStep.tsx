import React from "react";

import Project from "../../../models/Project";
import { ProjectDocument } from "../../../models/ProjectDocument";
import { AttachFiles } from "./AttachFiles";

type AttachFilesStepProps = {
    project: Project;
    onChange: (project: Project) => void;
};

export const AttachFilesStep: React.FC<AttachFilesStepProps> = props => {
    const { project, onChange } = props;

    const onAttachStepChange = React.useCallback(
        (projectDocuments: ProjectDocument[]) => {
            const newProject = project.setObj({ documents: projectDocuments });
            onChange(newProject);
        },
        [project, onChange]
    );

    return <AttachFiles onChange={onAttachStepChange} project={props.project} />;
};

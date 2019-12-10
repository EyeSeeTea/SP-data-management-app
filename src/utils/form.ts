import Project, { ProjectField } from "../models/Project";

export function getProjectFieldName(field: ProjectField): string {
    const name = Project.getFieldName(field);
    const requiredInfo = Project.isFieldRequired(field) ? " (*)" : "";
    return name + requiredInfo;
}

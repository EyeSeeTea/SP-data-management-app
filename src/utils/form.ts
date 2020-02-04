import React from "react";
import Project, { ProjectField } from "../models/Project";

export function getProjectFieldName(field: ProjectField): string {
    const name = Project.getFieldName(field);
    const requiredInfo = Project.isFieldRequired(field) ? " (*)" : "";
    return name + requiredInfo;
}

export function link(href: string): React.ReactNode {
    return React.createElement("a", { href, target: "_blank" }, href);
}

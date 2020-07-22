import React from "react";
import Project from "../../models/Project";
import { Ref } from "../../types/d2-api";

export function useSectionsSidebar(project: Project) {
    const items = React.useMemo(() => {
        return project.sectors.map(sector => ({ id: sector.id, text: sector.displayName }));
    }, [project]);

    const [sectorId, setSectorId] = React.useState<string>(items.length > 0 ? items[0].id : "");

    const setSector = React.useCallback((sector: Ref) => setSectorId(sector.id), [setSectorId]);

    return { items, sectorId, setSector };
}

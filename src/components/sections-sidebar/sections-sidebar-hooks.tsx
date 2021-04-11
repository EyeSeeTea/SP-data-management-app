import React from "react";
import i18n from "../../locales";
import Project from "../../models/Project";
import { Ref } from "../../types/d2-api";

type SectorId = string;
type Matches = Record<SectorId, number | undefined>;

export function useSectionsSidebar(project: Project) {
    const [matchesBySectorId, setMatchesBySectorId] = React.useState<Matches>();

    const items = React.useMemo(() => {
        return project.sectors.map(sector => {
            const matchesCount = matchesBySectorId ? matchesBySectorId[sector.id] : 0;
            const sectorText = sector.displayName + (matchesCount ? ` (${matchesCount})` : "");
            const matchesText = i18n.t("{{n}} matches", { n: matchesCount });
            const tooltipText = sector.displayName + (matchesCount ? ` (${matchesText})` : "");
            return { id: sector.id, text: sectorText, tooltipText };
        });
    }, [project.sectors, matchesBySectorId]);

    const [sectorId, setSectorId] = React.useState<string>(items.length > 0 ? items[0].id : "");

    const setSector = React.useCallback((sector: Ref) => setSectorId(sector.id), [setSectorId]);

    return { items, sectorId, setSector, onSectorsMatchChange: setMatchesBySectorId };
}

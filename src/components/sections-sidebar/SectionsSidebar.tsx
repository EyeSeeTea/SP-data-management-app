import React from "react";
import Sidebar, { SidebarProps, MenuItem } from "../steps/data-elements/Sidebar";
import { Id } from "../../types/d2-api";

interface SectionsSidebarProps {
    sectorId: Id;
    items: SidebarProps["menuItems"];
    setSector(sectorItem: MenuItem): void;
}

const SectionsSidebar: React.FC<SectionsSidebarProps> = props => {
    const { sectorId, items, setSector, children } = props;
    return (
        <Sidebar
            menuItems={items}
            currentMenuItemId={sectorId}
            onMenuItemClick={setSector}
            contents={<div style={styles.wrapper}>{children}</div>}
        />
    );
};

const styles = { wrapper: { width: "100%" } };

export default SectionsSidebar;

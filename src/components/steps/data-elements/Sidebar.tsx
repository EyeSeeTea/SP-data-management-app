import { Grid, MenuItem } from "@material-ui/core";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import { makeStyles, Theme } from "@material-ui/core/styles";
import classnames from "classnames";
import React, { ReactNode } from "react";

const useStyles = makeStyles((_theme: Theme) => ({
    list: {
        paddingTop: 0,
        paddingBottom: 0,
        backgroundColor: "transparent",
        marginTop: 8,
    },
    item: {
        fontSize: 14,
        borderRadius: 5,
        margin: 0,
        paddingRight: 80,
    },
    activeItem: {
        fontWeight: 700,
        color: "#2196f3",
        backgroundColor: "#e0e0e0",
    },
    sidebar: {
        backgroundColor: "#f3f3f3",
        overflowY: "auto",
    },
}));

type MenuItem = { id: string; text: string };

interface SidebarProps {
    menuItems: MenuItem[];
    currentMenuItemId?: string;
    onMenuItemClick: (menuItem: MenuItem) => void;
    contents: ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({
    menuItems,
    onMenuItemClick,
    currentMenuItemId,
    contents,
}) => {
    const classes = useStyles();
    const getItemClass = (item: MenuItem) =>
        classnames({
            [classes.item]: true,
            [classes.activeItem]: currentMenuItemId === item.id,
        });

    return (
        <Grid container spacing={2}>
            <Grid item className={classes.sidebar} data-test-sidebar>
                <List className={classes.list}>
                    {menuItems.map(item => (
                        <ListItem
                            className={getItemClass(item)}
                            button
                            key={item.id}
                            onClick={() => onMenuItemClick(item)}
                        >
                            <ListItemText primary={item.text} />
                        </ListItem>
                    ))}
                </List>
            </Grid>

            <Grid item xs={12} sm container>
                {contents}
            </Grid>
        </Grid>
    );
};

export default React.memo(Sidebar);

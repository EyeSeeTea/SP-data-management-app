import React from "react";
import ListIcon from "@material-ui/icons/List";
import PublicIcon from "@material-ui/icons/Public";
import i18n from "../../locales";
import { Tabs, Tab, makeStyles, Paper } from "@material-ui/core";

const views = ["projects", "countries"] as const;

export type ListView = typeof views[number];

interface ListSelectorProps {
    view: ListView;
    onChange(view: ListView): void;
}

const ListSelector: React.FunctionComponent<ListSelectorProps> = props => {
    const { onChange, view } = props;

    const setCurrentTab = React.useCallback(
        (_event: React.ChangeEvent<{}>, newValue) => {
            const view = views[newValue];
            if (view) onChange(view);
        },
        [onChange]
    );

    const value = views.indexOf(view);
    const classes = useStyles();

    return (
        <Paper className={classes.tabs}>
            <Tabs
                value={value}
                onChange={setCurrentTab}
                indicatorColor="primary"
                textColor="primary"
                aria-label="icon tabs example"
            >
                <Tab
                    classes={{ root: classes.tab }}
                    icon={<ListIcon />}
                    aria-label={i18n.t("Projects view")}
                    title={i18n.t("Projects view")}
                />
                <Tab
                    classes={{ root: classes.tab }}
                    icon={<PublicIcon />}
                    aria-label={i18n.t("Countries view")}
                    title={i18n.t("Countries view")}
                />
            </Tabs>
        </Paper>
    );
};

const useStyles = makeStyles({
    tabs: {
        marginLeft: "auto",
        order: 11,
    },
    tab: {
        minWidth: 50,
    },
});

export default ListSelector;

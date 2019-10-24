import React from "react";
import Paper from "@material-ui/core/Paper";
import Icon from "@material-ui/core/Icon";
import { makeStyles } from "@material-ui/core/styles";
import { Link } from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import ListItem from "@material-ui/core/ListItem";
import Typography from "@material-ui/core/Typography";
import i18n from "../../locales";
import { sizeHeight } from "@material-ui/system";

const useStyles = makeStyles({
    root: {
        display: "flex",
        flexGrow: 1,
        justifyContent: "center",
    },
    listItem: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        "&:hover": {
            backgroundColor: "#f9f9f9",
        },
        cursor: "pointer",
        padding: 50,
    },
    container: {
        width: "90%",
        padding: 10,
    },
    item: {
        padding: 20,
    },
    title: {
        marginLeft: 10,
        color: "#000000",
    },
    icon: {
        fontSize: "70px !important",
        marginRight: 10,
        color: "#000000",
    },
});

const getGridIndex = (size: number) => 12 / size;

const GRID_ROW_1 = getGridIndex(2);
const GRID_ROW_2 = getGridIndex(2);

export default function LandingPage() {
    const classes = useStyles();
    const items = [
        ["projects", i18n.t("Project Configuration"), "edit", GRID_ROW_1],
        ["report", i18n.t("Monthly Executive Report"), "description", GRID_ROW_2],
        ["data-entry", i18n.t("Data Entry"), "library_books", GRID_ROW_1],
        ["dashboard", i18n.t("Dashboard"), "dashboard", GRID_ROW_2],
    ];
    const menuItems = items.map(([key, title, icon, xs]) => (
        <Grid item xs={xs} className={classes.item} key={key}>
            <Paper>
                <ListItem
                    data-test={`page-${key}`}
                    component={Link}
                    to={`/${key}`}
                    className={classes.listItem}
                >
                    <Icon className={`material-icons ${classes.icon}`}>{icon}</Icon>
                    <Typography className={classes.title} variant="h5">
                        {title}
                    </Typography>
                </ListItem>
            </Paper>
        </Grid>
    ));

    return (
        <div className={classes.root}>
            <Grid container spacing={2} data-test="pages" className={classes.container}>
                {menuItems}
            </Grid>
        </div>
    );
}

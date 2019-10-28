import React from "react";
import Paper from "@material-ui/core/Paper";
import Icon from "@material-ui/core/Icon";
import { makeStyles } from "@material-ui/core/styles";
import { Link } from "react-router-dom";
import Grid, { GridSize } from "@material-ui/core/Grid";
import ListItem from "@material-ui/core/ListItem";
import Typography from "@material-ui/core/Typography";
import i18n from "../../locales";
import { generateUrl } from "../../router";

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

export default function LandingPage() {
    const classes = useStyles();
    const items = [
        {
            key: "projects",
            url: generateUrl("projects"),
            title: i18n.t("Project Configuration"),
            icon: "edit",
            width: 6, // GridSize: 1 to 12 (full width)
        },
        {
            key: "report",
            url: generateUrl("report"),
            title: i18n.t("Monthly Executive Report"),
            icon: "description",
            width: 6,
        },
        {
            key: "dataEntry",
            url: generateUrl("dataEntry"),
            title: i18n.t("Data Entry"),
            icon: "library_books",
            width: 6,
        },
        {
            key: "dashboard",
            url: generateUrl("dashboard"),
            title: i18n.t("Dashboard"),
            icon: "dashboard",
            width: 6,
        },
    ];
    const menuItems = items.map(({ key, url, title, icon, width }) => (
        <Grid item xs={width as GridSize} className={classes.item} key={key}>
            <Paper>
                <ListItem
                    data-test={`page-${key}`}
                    component={Link}
                    to={url}
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

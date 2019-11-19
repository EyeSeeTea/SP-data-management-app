import React from "react";
import i18n from "../locales";
import { withSnackbar } from "d2-ui-components";
import { withStyles } from "@material-ui/core/styles";
import { DialogTitle, createStyles, Theme } from "@material-ui/core";
class TargetValues extends React.Component {
    render() {
        const title = i18n.t("Set Target Population Name of Organit Unit");

        return <DialogTitle>{title}</DialogTitle>;
    }
}
const styles = (_theme: Theme) =>
    createStyles({
        warning: {
            marginBottom: 15,
            marginLeft: 3,
            fontSize: "1.1em",
            color: "#F00",
            textAlign: "center",
            backgroundColor: "#EEE",
            padding: 20,
        },
    });

export default withSnackbar(withStyles(styles)(TargetValues));

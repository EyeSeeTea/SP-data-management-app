import * as React from "react";
import moment from "moment";
import { Button } from "@material-ui/core";
import i18n from "../../locales";
import Project, { DataSet, monthFormat } from "../../models/Project";
import { useAppContext } from "../../contexts/api-context";
import { makeStyles } from "@material-ui/styles";

interface DataSetStateButtonProps {
    project: Project;
    dataSet: DataSet;
    period: string;
    onChange(): void;
}

const DataSetStateButton: React.FunctionComponent<DataSetStateButtonProps> = props => {
    const { currentUser } = useAppContext();
    const { period, dataSet, project, onChange } = props;
    const classes = useStyles();
    const projectDataSet = project.getProjectDataSet(dataSet);

    const dataSetInfo = React.useMemo(() => {
        return projectDataSet.getOpenInfo(moment(period, monthFormat));
    }, [projectDataSet, period]);

    const reopen = React.useCallback(() => {
        projectDataSet.reopen(period).then(onChange);
    }, [projectDataSet, onChange]);

    const reset = React.useCallback(() => {
        projectDataSet.reset().then(onChange);
    }, [projectDataSet, onChange]);

    if (!currentUser.can("reopen")) return null;

    return (
        <React.Fragment>
            {!dataSetInfo.isPeriodOpen && (
                <Button className={classes.button} onClick={reopen} variant="contained">
                    {i18n.t("Open dataset for the current month")}
                </Button>
            )}

            {dataSetInfo.isDataSetReopened && (
                <Button className={classes.button} onClick={reset} variant="contained">
                    {i18n.t("Reset dataset")}
                </Button>
            )}
        </React.Fragment>
    );
};

const useStyles = makeStyles({
    button: { marginLeft: 10, marginRight: 10 },
});

export default DataSetStateButton;

import * as React from "react";
import moment from "moment";
import { Button, LinearProgress } from "@material-ui/core";
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
    const [isActive, setActive] = React.useState(false);
    const { currentUser } = useAppContext();
    const { period, dataSet, project, onChange } = props;
    const classes = useStyles();
    const projectDataSet = project.getProjectDataSet(dataSet);

    const dataSetInfo = React.useMemo(() => {
        return projectDataSet.getOpenInfo(moment(period, monthFormat));
    }, [projectDataSet, period]);

    function notifyOnChange() {
        setActive(false);
        onChange();
    }

    const reopen = React.useCallback(() => {
        setActive(true);
        projectDataSet.reopen().then(notifyOnChange);
    }, [projectDataSet, onChange]);

    const reset = React.useCallback(() => {
        setActive(true);
        projectDataSet.reset().then(notifyOnChange);
    }, [projectDataSet, onChange]);

    if (!currentUser.can("reopen")) return null;

    return (
        <React.Fragment>
            {!dataSetInfo.isPeriodOpen && (
                <Button
                    disabled={isActive}
                    className={classes.button}
                    onClick={reopen}
                    variant="contained"
                >
                    {i18n.t("Open dataset")}
                </Button>
            )}

            {dataSetInfo.isPeriodOpen && dataSetInfo.isDataSetReopened && (
                <Button
                    disabled={isActive}
                    className={classes.button}
                    onClick={reset}
                    variant="contained"
                >
                    {i18n.t("Set default entry periods")}
                </Button>
            )}

            {isActive && <LinearProgress style={{ marginTop: 20 }} />}
        </React.Fragment>
    );
};

const useStyles = makeStyles({
    button: { marginLeft: 10, marginRight: 10 },
});

export default DataSetStateButton;

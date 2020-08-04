import * as React from "react";
import moment from "moment";
import { Button, LinearProgress } from "@material-ui/core";
import i18n from "../../locales";
import Project, { DataSet, monthFormat } from "../../models/Project";
import { useAppContext } from "../../contexts/api-context";
import { makeStyles } from "@material-ui/styles";
import { useMemoAsync, useConfirmation, useSnackbarOnError } from "../../utils/hooks";

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
    const showErrorAndSetInactive = useSnackbarOnError(() => setActive(false));

    const dataSetInfo = useMemoAsync(() => {
        return projectDataSet.getOpenInfo(moment(period, monthFormat));
    }, [projectDataSet, period]);

    function notifyOnChange() {
        setActive(false);
        onChange();
    }

    const reopen = React.useCallback(() => {
        setActive(true);
        const unapprovePeriod = dataSetInfo && !dataSetInfo.isOpenByData ? period : undefined;
        projectDataSet
            .reopen({ unapprovePeriod })
            .then(notifyOnChange)
            .catch(showErrorAndSetInactive);
    }, [projectDataSet, period, onChange, dataSetInfo]);

    const reset = React.useCallback(() => {
        setActive(true);
        projectDataSet
            .reset()
            .then(notifyOnChange)
            .catch(showErrorAndSetInactive);
    }, [projectDataSet, onChange]);

    const reopenConfirmation = useConfirmation({
        title: i18n.t("Reopen data set"),
        text: i18n.t(
            "This data set has been approved. We need to unapprove it to open the data set. You will have to approve the data again on the Data Approval section. Do you want to proceed?"
        ),
        onConfirm: reopen,
    });

    const userCanReopen = currentUser.can("reopen");
    if (!dataSetInfo) return <LinearProgress />;

    return (
        <React.Fragment>
            {reopenConfirmation.render()}

            {!dataSetInfo.isOpen && !userCanReopen
                ? i18n.t("Project closed for this period, please contact the administrators")
                : null}

            {!dataSetInfo.isOpen && userCanReopen && (
                <Button
                    disabled={isActive}
                    className={classes.button}
                    onClick={dataSetInfo.isOpenByData ? reopen : reopenConfirmation.open}
                    variant="contained"
                >
                    {i18n.t("Edit Data")}
                </Button>
            )}

            {dataSetInfo.isOpen && dataSetInfo.isReopened && userCanReopen && (
                <Button
                    disabled={isActive}
                    className={classes.button}
                    onClick={reset}
                    variant="contained"
                >
                    {i18n.t("Editing Complete")}
                </Button>
            )}

            {isActive && <LinearProgress style={{ marginTop: 20 }} />}
        </React.Fragment>
    );
};

const useStyles = makeStyles({
    button: { marginLeft: 10, marginRight: 10 },
});

export default React.memo(DataSetStateButton);

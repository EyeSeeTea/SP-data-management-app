import * as React from "react";
import moment from "moment";
import { Button, LinearProgress } from "@material-ui/core";
import i18n from "../../locales";
import Project, { DataSet, DataSetType, monthFormat } from "../../models/Project";
import { useAppContext } from "../../contexts/api-context";
import { useConfirmation, useSnackbarOnError } from "../../utils/hooks";
import { DataSetOpenInfo } from "../../models/ProjectDataSet";
import { UseValidationResponse } from "./validation-hooks";
import { ProjectNotification } from "../../models/ProjectNotification";
import { useSnackbar } from "@eyeseetea/d2-ui-components";

interface DataSetStateButtonProps {
    project: Project;
    dataSet: DataSet;
    dataSetType: DataSetType;
    period: string;
    onChange(): void;
    validation: UseValidationResponse;
}

const DataSetStateButton: React.FunctionComponent<DataSetStateButtonProps> = props => {
    const [isActive, setActive] = React.useState(false);
    const { api, currentUser, isTest, appConfig } = useAppContext();
    const { period, dataSetType, dataSet, project, onChange, validation } = props;
    const projectDataSet = project.getProjectDataSet(dataSet);
    const showErrorAndSetInactive = useSnackbarOnError(() => setActive(false));
    const snackbar = useSnackbar();

    const [dataSetInfo, setDataSetInfo] = React.useState<DataSetOpenInfo>();
    React.useEffect(() => {
        projectDataSet.getOpenInfo(moment(period, monthFormat)).then(setDataSetInfo);
    }, [projectDataSet, period]);

    const notifyOnChange = React.useCallback(() => {
        setActive(false);
        onChange();
    }, [onChange]);

    const reopen = React.useCallback(() => {
        setActive(true);
        const unapprovePeriod = dataSetInfo && !dataSetInfo.isOpenByData ? period : undefined;
        projectDataSet
            .reopen({ unapprovePeriod })
            .then(notifyOnChange)
            .catch(showErrorAndSetInactive);
    }, [projectDataSet, period, dataSetInfo, notifyOnChange, showErrorAndSetInactive]);

    const reset = React.useCallback(() => {
        if (!validation.validate({ showValidation: true })) return;
        setActive(true);
        projectDataSet.reset().then(notifyOnChange).catch(showErrorAndSetInactive);
    }, [projectDataSet, notifyOnChange, showErrorAndSetInactive, validation]);

    const notifyUsers = React.useCallback(async () => {
        try {
            const notificator = new ProjectNotification(
                api,
                appConfig,
                project,
                currentUser,
                isTest
            );
            const emailSent = await notificator.notifyForDataReview(
                period,
                dataSet.id,
                dataSetType
            );
            if (emailSent) {
                snackbar.success(i18n.t("An email has been sent to the data reviewers"));
            } else {
                snackbar.warning(i18n.t("No data reviewers found, no email sent"));
            }
        } catch (err: any) {
            snackbar.error(err.message);
        }
    }, [api, project, currentUser, isTest, period, dataSet.id, dataSetType, snackbar, appConfig]);

    const reopenConfirmation = useConfirmation({
        title: i18n.t("Reopen data set"),
        text: i18n.t(
            "This data set has been approved. We need to unapprove it to open the data set. You will have to approve the data again on the Data Approval section. Do you want to proceed?"
        ),
        onConfirm: reopen,
    });

    const openDataReviewConfirmation = useConfirmation({
        title: i18n.t("Notify users on data review"),
        text: i18n.t(
            "Are you sure you want to send an email to Data Reviewers asking for approval?"
        ),
        onConfirm: notifyUsers,
    });

    const userCanReopen = currentUser.can("reopen");
    if (!dataSetInfo) return <LinearProgress />;

    return (
        <React.Fragment>
            {reopenConfirmation.render()}
            {openDataReviewConfirmation.render()}

            {!dataSetInfo.isOpen && !userCanReopen
                ? i18n.t("Project closed for this period, please contact the administrators")
                : null}

            {!dataSetInfo.isOpen && userCanReopen && (
                <>
                    <Button
                        disabled={isActive}
                        style={styles.button}
                        onClick={dataSetInfo.isOpenByData ? reopen : reopenConfirmation.open}
                        variant="contained"
                    >
                        {i18n.t("Edit Data")}
                    </Button>
                </>
            )}

            {dataSetInfo.isOpen && dataSetInfo.isReopened && userCanReopen && (
                <Button
                    disabled={isActive}
                    style={styles.button}
                    onClick={reset}
                    variant="contained"
                >
                    {i18n.t("Editing Complete")}
                </Button>
            )}

            <Button
                disabled={isActive}
                style={styles.button}
                onClick={openDataReviewConfirmation.open}
                variant="contained"
            >
                {i18n.t("Ask for Data Review")}
            </Button>

            {isActive && <LinearProgress style={{ marginTop: 20 }} />}
        </React.Fragment>
    );
};

const styles = {
    button: { marginLeft: 10, marginRight: 10 },
};

export default React.memo(DataSetStateButton);

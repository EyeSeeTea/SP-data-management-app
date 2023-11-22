import * as React from "react";
import { Button, LinearProgress } from "@material-ui/core";
import i18n from "../../locales";
import Project, { DataSet, DataSetType } from "../../models/Project";
import { useAppContext } from "../../contexts/api-context";
import { useConfirmation, useSnackbarOnError } from "../../utils/hooks";
import { DataSetOpenInfo } from "../../models/ProjectDataSet";
import { UseValidationResponse } from "./validation-hooks";
import { ProjectNotification } from "../../models/ProjectNotification";
import { useLoading, useSnackbar } from "@eyeseetea/d2-ui-components";
import { Maybe } from "../../types/utils";

interface DataSetStateButtonProps {
    project: Project;
    dataSet: DataSet;
    dataSetType: DataSetType;
    period: string;
    onChange(): void;
    validation: UseValidationResponse;
    dataSetInfo: Maybe<DataSetOpenInfo>;
}

const DataSetStateButton: React.FunctionComponent<DataSetStateButtonProps> = props => {
    const [isActive, setActive] = React.useState(false);
    const { api, currentUser, isTest } = useAppContext();
    const loading = useLoading();
    const { period, dataSetType, dataSet, project, onChange, validation, dataSetInfo } = props;
    const projectDataSet = project.getProjectDataSet(dataSet);
    const showErrorAndSetInactive = useSnackbarOnError(() => setActive(false));
    const snackbar = useSnackbar();

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

    const reset = React.useCallback(async () => {
        if (!(await validation.validate({ showValidation: true }))) return;
        setActive(true);
        projectDataSet.reset().then(notifyOnChange).catch(showErrorAndSetInactive);
    }, [projectDataSet, notifyOnChange, showErrorAndSetInactive, validation]);

    const notifyUsers = React.useCallback(async () => {
        try {
            const notificator = new ProjectNotification(api, project, currentUser, isTest);
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
    }, [api, project, currentUser, isTest, period, dataSet.id, dataSetType, snackbar]);

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

    const openApplyToAllMonthsConfirmation = useConfirmation({
        title: i18n.t("Apply to all months"),
        text: i18n.t(
            "This action is going to unapprove all the periods. You will have to approve the data again on the Data Approval section. Are you sure you want to apply the current values to all months? The existing data in other months will be overwritten."
        ),
        onConfirm: () => {
            loading.show(true, i18n.t("Applying values to all months..."));
            projectDataSet
                .applyToAllMonths(period)
                .then(() => {
                    snackbar.success(i18n.t("Values applied to all months"));
                    notifyOnChange();
                })
                .catch(snackbar.error)
                .finally(() => {
                    loading.hide();
                });
        },
    });

    const onApplyToAllMonths = () => {
        openApplyToAllMonthsConfirmation.open();
    };

    const { validate } = validation;

    const askForDataReview = React.useCallback(async () => {
        if (!(await validate({ showValidation: true }))) return;
        openDataReviewConfirmation.open();
    }, [validate, openDataReviewConfirmation]);

    const userCanReopen = currentUser.can("reopen");
    if (!dataSetInfo) return <LinearProgress />;

    return (
        <React.Fragment>
            {reopenConfirmation.render()}
            {openDataReviewConfirmation.render()}
            {openApplyToAllMonthsConfirmation.render()}

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
                onClick={askForDataReview}
                variant="contained"
            >
                {i18n.t("Ask for Data Review")}
            </Button>

            {dataSetType === "target" && (
                <Button style={styles.button} onClick={onApplyToAllMonths} variant="contained">
                    {i18n.t("Apply to all months")}
                </Button>
            )}

            {isActive && <LinearProgress style={{ marginTop: 20 }} />}
        </React.Fragment>
    );
};

const styles = {
    button: { marginLeft: 10, marginRight: 10 },
};

export default React.memo(DataSetStateButton);

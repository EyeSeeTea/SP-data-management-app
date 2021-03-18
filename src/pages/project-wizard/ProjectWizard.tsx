import React from "react";
import { useLocation } from "react-router";
import _ from "lodash";
import { Wizard, useSnackbar } from "d2-ui-components";
import { LinearProgress } from "@material-ui/core";
import { Location } from "history";

import Project, { ValidationKey } from "../../models/Project";
import { D2Api } from "../../types/d2-api";
import { generateUrl } from "../../router";
import i18n from "../../locales";
import ExitWizardButton from "../../components/wizard/ExitWizardButton";
import PageHeader from "../../components/page-header/PageHeader";
import { useAppContext } from "../../contexts/api-context";
import GeneralInfoStep from "../../components/steps/general-info/GeneralInfoStep";
import SectorsStep from "../../components/steps/sectors/SectorsStep";
import OrgUnitsStep from "../../components/steps/org-units/OrgUnitsStep";
import SaveStep from "../../components/steps/save/SaveStep";
import { getDevProject } from "../../models/dev-project";
import { Config } from "../../models/Config";
import { helpTexts } from "./help-texts";
import { ReactComponentLike } from "prop-types";
import SharingStep from "../../components/steps/sharing/SharingStep";
import DisaggregationStep from "../../components/steps/disaggregation/DisaggregationStep";
import DataElementsSelectionStep from "../../components/steps/data-elements-selection/DataElementsSelectionStep";
import MerSelectionStep from "../../components/steps/mer-selection/MerSelectionStep";
import { useAppHistory } from "../../utils/use-app-history";

type Action = { type: "create" } | { type: "edit"; id: string };

interface ProjectWizardProps {
    action: Action;
}

export interface StepProps {
    api: D2Api;
    project: Project;
    onChange: (project: Project) => void;
    onCancel: () => void;
    action: "create" | "update";
}

interface Props {
    api: D2Api;
    config: Config;
    goBack(): void;
    location: Location;
    snackbar: any;
    action: Action;
    isDev: boolean;
}

interface State {
    project: Project | undefined;
    dialogOpen: boolean;
    isUpdated: boolean;
}

interface Step {
    key: string;
    label: string;
    component: ReactComponentLike;
    validationKeys?: ValidationKey[];
    validationKeysLive?: ValidationKey[];
    description?: string;
    help?: React.ReactNode;
}

class ProjectWizardImpl extends React.Component<Props, State> {
    state: State = {
        project: undefined,
        dialogOpen: false,
        isUpdated: false,
    };

    async componentDidMount() {
        const { api, config, action, isDev } = this.props;

        try {
            const project =
                action.type === "create"
                    ? getDevProject(Project.create(api, config), isDev)
                    : await Project.get(api, config, action.id);
            this.setState({ project });
        } catch (err) {
            console.error(err);
            this.props.snackbar.error(i18n.t("Cannot load project") + `: ${err.message || err}`);
            this.props.goBack();
        }
    }

    isEdit() {
        return this.props.action.type === "edit";
    }

    getStepsBaseInfo(): Step[] {
        return [
            {
                key: "general-info",
                label: i18n.t("General info"),
                component: GeneralInfoStep,
                validationKeys: [
                    "name",
                    "startDate",
                    "endDate",
                    "endDateAfterStartDate",
                    "awardNumber",
                    "subsequentLettering",
                    "code",
                    "funders",
                ],
                description: i18n.t(`Please fill out information below for your project:`),
                help: helpTexts.generalInfo,
            },
            {
                key: "organisation-units",
                label: i18n.t("Country & Project Locations"),
                component: OrgUnitsStep,
                validationKeys: ["parentOrgUnit", "locations"],
                description: i18n.t(
                    `Please select your country office and project location/s below:`
                ),
                help: helpTexts.organisationUnits,
            },
            {
                key: "sectors",
                label: i18n.t("Sectors"),
                component: SectorsStep,
                validationKeys: ["sectors"],
                help: helpTexts.sectors,
            },
            {
                key: "indicators",
                label: i18n.t("Selection of Indicators"),
                component: DataElementsSelectionStep,
                validationKeys: ["dataElementsSelection"],
                help: helpTexts.indicators,
            },
            {
                key: "disaggregation",
                label: i18n.t("Disaggregation"),
                component: DisaggregationStep,
                validationKeys: [],
                help: helpTexts.disaggregation,
            },
            {
                key: "mer-indicators",
                label: i18n.t("Selection of MER Indicators"),
                component: MerSelectionStep,
                validationKeys: ["dataElementsMER"],
                help: helpTexts.merIndicators,
            },
            {
                key: "sharing",
                label: i18n.t("Username Access"),
                component: SharingStep,
                description: i18n.t("Define Sharing settings for project data."),
            },
            {
                key: "save",
                label: i18n.t("Summary and Save"),
                component: SaveStep,
                description: i18n.t(
                    "The setup of your project is complete. Please review the information below and click the “Save” button once complete."
                ),
                help: helpTexts.save,
            },
        ];
    }

    cancelSave = () => {
        const { isUpdated } = this.state;

        if (isUpdated) {
            this.setState({ dialogOpen: true });
        } else {
            this.props.goBack();
        }
    };

    goBack = () => {
        this.props.goBack();
    };

    handleDialogCancel = () => {
        this.setState({ dialogOpen: false });
    };

    onChange = (step: Step) => async (project: Project) => {
        const errors = await getValidationMessages(project, step.validationKeysLive || []);
        this.setState({ project, isUpdated: true });

        if (!_(errors).isEmpty()) {
            this.props.snackbar.error(errors.join("\n"));
        }
    };

    onStepChangeRequest = async (currentStep: Step) => {
        return await getValidationMessages(this.state.project, currentStep.validationKeys);
    };

    render() {
        const { project, dialogOpen } = this.state;
        const { api, location, action } = this.props;
        if (project) Object.assign(window, { project, Project });

        const steps = this.getStepsBaseInfo().map(step => ({
            ...step,
            props: {
                project,
                api,
                onChange: this.onChange(step),
                onCancel: this.goBack,
                action: action.type,
            },
        }));

        const urlHash = location.hash.split("#")[1];
        const stepExists = steps.find(step => step.key === urlHash);
        const firstStepKey = steps.map(step => step.key)[0];
        const initialStepKey = stepExists ? urlHash : firstStepKey;
        const lastClickableStepIndex = this.isEdit() ? steps.length - 1 : 0;
        const title = this.isEdit() ? i18n.t("Edit project") : i18n.t("New project");

        return (
            <React.Fragment>
                <ExitWizardButton
                    isOpen={dialogOpen}
                    onConfirm={this.goBack}
                    onCancel={this.handleDialogCancel}
                />
                <PageHeader
                    title={`${title}: ${project ? project.name : i18n.t("Loading...")}`}
                    onBackClick={this.cancelSave}
                />
                {project ? (
                    <Wizard
                        steps={steps}
                        initialStepKey={initialStepKey}
                        useSnackFeedback={true}
                        onStepChangeRequest={this.onStepChangeRequest}
                        lastClickableStepIndex={lastClickableStepIndex}
                    />
                ) : (
                    <LinearProgress />
                )}
            </React.Fragment>
        );
    }
}

async function getValidationMessages(
    project: Project | undefined,
    validationKeys: ValidationKey[] | undefined
): Promise<string[]> {
    if (!project || !validationKeys || validationKeys.length === 0) return [];

    const validationObj = await project.validate(validationKeys);

    return _(validationObj)
        .at(validationKeys)
        .flatten()
        .compact()
        .value();
}

const ProjectWizardImplMemo = React.memo(ProjectWizardImpl);

const ProjectWizard: React.FC<ProjectWizardProps> = props => {
    const snackbar = useSnackbar();
    const location = useLocation();
    const { api, config, isDev } = useAppContext();
    const { action } = props;
    const appHistory = useAppHistory(generateUrl("projects"));

    return (
        <ProjectWizardImplMemo
            snackbar={snackbar}
            api={api}
            config={config}
            goBack={appHistory.goBack}
            location={location}
            action={action}
            isDev={isDev}
        />
    );
};

export default React.memo(ProjectWizard);

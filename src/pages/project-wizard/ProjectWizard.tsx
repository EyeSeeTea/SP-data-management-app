import React from "react";
import { useHistory, useLocation, useRouteMatch } from "react-router";
import _ from "lodash";
import { Wizard, useSnackbar } from "d2-ui-components";
import { LinearProgress } from "@material-ui/core";
import { History, Location } from "history";

import Project, { ValidationKey } from "../../models/Project";
import { D2Api } from "d2-api";
import { generateUrl } from "../../router";
import i18n from "../../locales";
import ExitWizardButton from "../../components/wizard/ExitWizardButton";
import PageHeader from "../../components/page-header/PageHeader";
import { useAppContext } from "../../contexts/api-context";
import GeneralInfoStep from "../../components/steps/general-info/GeneralInfoStep";
import SectorsStep from "../../components/steps/sectors/SectorsStep";
import OrgUnitsStep from "../../components/steps/org-units/OrgUnitsStep";
import SaveStep from "../../components/steps/save/SaveStep";
import DataElementsStep from "../../components/steps/data-elements/DataElementsStep";
import { getDevProject } from "../../models/dev-project";
import { Config } from "../../models/Config";

export interface StepProps {
    api: D2Api;
    project: Project;
    onChange: (project: Project) => void;
    onCancel: () => void;
}

interface Props {
    api: D2Api;
    config: Config;
    history: History;
    location: Location;
    snackbar: any;
    match: null | { params: { id?: string } };
}

interface State {
    project: Project | undefined;
    dialogOpen: boolean;
    isUpdated: boolean;
}

interface Step {
    key: string;
    label: string;
    component: React.ReactNode;
    validationKeys?: ValidationKey[];
    validationKeysLive?: ValidationKey[];
    description?: string;
    help?: string;
}

class ProjectWizardImpl extends React.Component<Props, State> {
    state: State = {
        project: undefined,
        dialogOpen: false,
        isUpdated: false,
    };

    async componentDidMount() {
        const { api, config, match, location } = this.props;
        const isDevMode = location.hash.split("#")[2] == "dev";

        try {
            const project =
                match && match.params.id
                    ? await Project.get(api, config, match.params.id)
                    : getDevProject(await Project.create(api, config), isDevMode);
            this.setState({ project });
        } catch (err) {
            console.error(err);
            this.props.snackbar.error(i18n.t("Cannot load project") + `: ${err.message || err}`);
            this.props.history.push(generateUrl("projects"));
        }
    }

    isEdit() {
        return this.props.match && !!this.props.match.params.id;
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
                    "awardNumber",
                    "subsequentLettering",
                    "code",
                    "funders",
                ],
                description: i18n.t(
                    `Choose a name for the project and define the period for which data entry will be enabled and select funders for your project`
                ),
                help: i18n.t("TODO"),
            },
            {
                key: "organisation-units",
                label: i18n.t("Organisation Unit"),
                component: OrgUnitsStep,
                validationKeys: ["parentOrgUnit"],
                description: i18n.t(
                    `Select the organisation unit associated with the project. At least one must be selected.`
                ),
                help: i18n.t("TODO"),
            },
            {
                key: "sectors",
                label: i18n.t("Sectors & Project Locations"),
                component: SectorsStep,
                validationKeys: ["sectors", "locations"],
                help: i18n.t("TODO"),
            },
            {
                key: "indicators",
                label: i18n.t("Selection of Indicators"),
                component: DataElementsSelection,
                validationKeys: ["dataElements"],
                help: i18n.t("TODO"),
            },
            {
                key: "mer-indicators",
                label: i18n.t("Selection of MER Indicators"),
                component: DataElementsMER,
                validationKeys: ["dataElementsMER"],
                help: i18n.t("TODO"),
            },
            {
                key: "save",
                label: i18n.t("Summary and Save"),
                component: SaveStep,
                description: i18n.t(
                    'Setup of your project is complete. Click the "Save" button to save your project.'
                ),
                help: i18n.t(
                    `Please review the project summary. Click the "Save" button to create the data set and all associated metadata for this project`
                ),
            },
        ];
    }

    cancelSave = () => {
        const { isUpdated } = this.state;

        if (isUpdated) {
            this.setState({ dialogOpen: true });
        } else {
            this.goToConfiguration();
        }
    };

    goToConfiguration = () => {
        this.props.history.push(generateUrl("projects"));
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
        const { api, location } = this.props;
        if (project) Object.assign(window, { project, Project });

        const steps = this.getStepsBaseInfo().map(step => ({
            ...step,
            props: {
                project,
                api,
                onChange: this.onChange(step),
                onCancel: this.goToConfiguration,
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
                    onConfirm={this.goToConfiguration}
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
) {
    if (!project || !validationKeys || validationKeys.length === 0) return [];

    const validationObj = await project.validate(validationKeys);

    return _(validationObj)
        .at(validationKeys)
        .flatten()
        .compact()
        .value();
}

const ProjectWizard: React.FC<{}> = () => {
    const snackbar = useSnackbar();
    const history = useHistory();
    const location = useLocation();
    const { api, config } = useAppContext();
    const match = useRouteMatch();

    return (
        <ProjectWizardImpl
            snackbar={snackbar}
            api={api}
            config={config}
            history={history}
            location={location}
            match={match}
        />
    );
};

const DataElementsSelection: React.FC<StepProps> = props => (
    <DataElementsStep {...props} field="selection" />
);

const DataElementsMER: React.FC<StepProps> = props => <DataElementsStep {...props} field="MER" />;

export default ProjectWizard;

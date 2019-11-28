import React from "react";
import _ from "lodash";
import { Moment } from "moment";
import { Card, CardContent } from "@material-ui/core";
import { DatePicker } from "d2-ui-components";

import i18n from "../../../locales";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import Project from "../../../models/Project";
import Funders from "./Funders";

/* eslint-disable @typescript-eslint/no-var-requires */
const { TextField } = require("@dhis2/d2-ui-core");
const { FormBuilder, Validators } = require("@dhis2/d2-ui-forms");

type StringField = "name" | "description" | "awardNumber" | "subsequentLettering" | "speedKey";

type DateField = "startDate" | "endDate";

type ProjectData = Pick<Project, StringField | DateField /* | NumberField */>;

class GeneralInfoStep extends React.Component<StepProps> {
    onUpdateField = <K extends keyof ProjectData>(fieldName: K, newValue: ProjectData[K]) => {
        const { project, onChange } = this.props;
        const newProject = project.set(fieldName, newValue as Project[K]);
        onChange(newProject);
    };

    render() {
        const { project } = this.props;
        const fields = [
            getTextField("name", i18n.t("Name"), project.name, {
                validators: [validators.presence],
            }),
            getTextField("description", i18n.t("Description"), project.description, {
                props: { multiLine: true },
            }),
            getTextField("awardNumber", i18n.t("Award Number"), project.awardNumber, {
                props: { type: "number" },
                validators: [
                    validators.length({
                        min: Project.lengths.awardNumber,
                        max: Project.lengths.awardNumber,
                    }),
                ],
            }),
            getTextField(
                "subsequentLettering",
                i18n.t("Subsequent Lettering"),
                project.subsequentLettering,
                {
                    validators: [
                        validators.length({
                            min: Project.lengths.subsequentLettering,
                            max: Project.lengths.subsequentLettering,
                        }),
                    ],
                }
            ),
            getTextField("speedKey", i18n.t("Speed Key"), project.speedKey, {
                validators: [
                    validators.length({
                        max: Project.lengths.speedKey,
                    }),
                ],
            }),
            getDateField("startDate", i18n.t("Start Date"), project.startDate, {
                onUpdateField: this.onUpdateField,
            }),
            getDateField("endDate", i18n.t("End Date"), project.endDate, {
                onUpdateField: this.onUpdateField,
            }),
        ];

        return (
            <Card>
                <CardContent>
                    <FormBuilder fields={fields} onUpdateField={this.onUpdateField} />
                    <Funders
                        project={project}
                        api={project.api}
                        onChange={this.props.onChange}
                        onCancel={this.props.onCancel}
                    />
                </CardContent>
            </Card>
        );
    }
}

type Validator<T> = { message: string; validator: (value: T) => boolean };

const validators = {
    presence: {
        message: i18n.t("Field cannot be blank"),
        validator: Validators.isRequired,
    },
    length: ({ min, max }: { min?: number; max?: number }) => ({
        message:
            i18n.t("Field length is invalid") +
            ": " +
            _.compact([min && `min=${min}`, max && `max=${max}`]).join(", "),
        validator: (s: string) =>
            (min === undefined || s.length >= min) && (max == undefined || s.length <= max),
    }),
};

function getTextField(
    name: StringField,
    humanName: string,
    value: string,
    { validators, props }: { validators?: Validator<string>[]; props?: _.Dictionary<any> } = {}
) {
    return {
        name,
        value,
        component: TextField,
        props: {
            floatingLabelText: humanName,
            style: { width: "33%" },
            changeEvent: "onBlur",
            "data-field": name,
            ...(props || {}),
        },
        validators: validators || [],
    };
}

function getDateField(
    name: DateField,
    humanName: string,
    value: Moment | undefined,
    {
        onUpdateField,
        props,
    }: {
        onUpdateField: (name: DateField, value: Moment) => void;
        props?: Partial<DatePicker["props"]>;
    }
) {
    return {
        name,
        value,
        component: DatePicker,
        props: {
            label: humanName,
            value: value ? value.toDate() : null,
            onChange: (value: Moment) => onUpdateField(name, value),
            ...(props || {}),
        },
    };
}

export default GeneralInfoStep;

import React from "react";
import _ from "lodash";
import { Moment } from "moment";
import { Card, CardContent } from "@material-ui/core";
import { DatePicker } from "d2-ui-components";

import i18n from "../../../locales";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import Project from "../../../models/Project";
import Funders from "./Funders";
import { getProjectFieldName } from "../../../utils/form";

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
            getTextField("name", project.name, {
                validators: [validators.presence],
            }),
            getTextField("description", project.description, {
                props: { multiLine: true },
            }),
            getTextField("awardNumber", project.awardNumber, {
                props: { type: "number" },
                validators: [
                    validators.length({
                        min: Project.lengths.awardNumber,
                        max: Project.lengths.awardNumber,
                        message: i18n.t("Field should be a 5-digit number"),
                    }),
                ],
            }),
            getTextField("subsequentLettering", project.subsequentLettering, {
                validators: [
                    validators.presence,
                    validators.regexp(
                        /^[a-zA-Z]{2}$/,
                        i18n.t("Field must be composed by two letter characters")
                    ),
                ],
            }),
            getTextField("speedKey", project.speedKey, {
                validators: [
                    validators.length({
                        max: Project.lengths.speedKey,
                    }),
                ],
            }),
            getDateField("startDate", project.startDate, {
                onUpdateField: this.onUpdateField,
            }),
            getDateField("endDate", project.endDate, {
                onUpdateField: this.onUpdateField,
            }),
        ];
        return (
            <Card>
                <CardContent>
                    <FormBuilder fields={fields} onUpdateField={this.onUpdateField} />
                    <Funders project={project} onChange={this.props.onChange} />
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
    length: ({ min, max, message }: { min?: number; max?: number; message?: string }) => ({
        message:
            message ||
            i18n.t("Field length is invalid") +
                ": " +
                _.compact([min && `min=${min}`, max && `max=${max}`]).join(", "),
        validator: (s: string) =>
            (min === undefined || s.length >= min) && (max == undefined || s.length <= max),
    }),
    regexp: (regexp: RegExp, message: string) => ({
        message,
        validator: (s: string) => regexp.test(s),
    }),
};

function getTextField(
    name: StringField,
    value: string,
    { validators, props }: { validators?: Validator<string>[]; props?: _.Dictionary<any> } = {}
) {
    const humanName = getProjectFieldName(name);
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
    value: Moment | undefined,
    {
        onUpdateField,
        props,
    }: {
        onUpdateField: (name: DateField, value: Moment) => void;
        props?: Partial<DatePicker["props"]>;
    }
) {
    const humanName = getProjectFieldName(name);
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

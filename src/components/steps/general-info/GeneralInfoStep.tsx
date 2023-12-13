import React from "react";
import _ from "lodash";
import { Moment } from "moment";
import { Card, CardContent, Checkbox, FormControlLabel } from "@material-ui/core";
import { DatePicker, DatePickerProps } from "@eyeseetea/d2-ui-components";

import i18n from "../../../locales";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import Project from "../../../models/Project";
import Funders from "./Funders";
import { getProjectFieldName } from "../../../utils/form";

/* eslint-disable @typescript-eslint/no-var-requires */
const { TextField } = require("@dhis2/d2-ui-core");
const { FormBuilder, Validators } = require("@dhis2/d2-ui-forms");

type StringField = "name" | "description" | "awardNumber" | "subsequentLettering" | "additional";

type DateField = "startDate" | "endDate";

type BooleanField = "isDartApplicable" | "partner";

type ProjectData = Pick<Project, StringField | DateField | BooleanField>;

class GeneralInfoStep extends React.Component<StepProps> {
    onUpdateField = <K extends keyof ProjectData>(fieldName: K, newValue: ProjectData[K]) => {
        const { project, onChange } = this.props;
        const newProject = project.set(fieldName, newValue as Project[K]);
        onChange(newProject);
    };

    render() {
        const { project } = this.props;
        const { subsequentLettering } = Project.formats();

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
                    validators.regexp(subsequentLettering.regexp, subsequentLettering.msg),
                ],
            }),
            getTextField("additional", project.additional, {
                validators: [
                    validators.length({
                        max: Project.lengths.additional,
                    }),
                ],
            }),
            getDateField("startDate", project.startDate, {
                onUpdateField: this.onUpdateField,
                process: (date: Moment) => date.startOf("month"),
            }),
            getDateField("endDate", project.endDate, {
                onUpdateField: this.onUpdateField,
                process: (date: Moment) => date.endOf("month"),
            }),
            getCheckBoxField("isDartApplicable", project.isDartApplicable, {
                onUpdateField: this.onUpdateField,
                props: {
                    checked: project.isDartApplicable,
                },
            }),
            getCheckBoxField("partner", project.partner, {
                onUpdateField: this.onUpdateField,
                props: {
                    checked: project.partner,
                },
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
            (min === undefined || s.length >= min) && (max === undefined || s.length <= max),
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
        process,
        props,
    }: {
        onUpdateField: (name: DateField, value: Moment | undefined) => void;
        process: (date: Moment) => Moment;
        props?: Partial<DatePickerProps>;
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
            onChange: (date: Moment | undefined) =>
                onUpdateField(name, date ? process(date) : undefined),
            format: "MMMM YYYY",
            views: ["year", "month"],
            className: "date-picker",
            ...(props || {}),
        },
    };
}

function getCheckBoxField(
    name: BooleanField,
    value: boolean,
    {
        onUpdateField,
        props,
    }: {
        onUpdateField: (name: BooleanField, value: boolean) => void;
        props?: _.Dictionary<any>;
    }
) {
    const humanName = getProjectFieldName(name);
    return {
        name,
        value,
        component: CheckBoxWithLabel,
        props: {
            label: humanName,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                onUpdateField(name, event.target.checked),
            ...(props || {}),
        },
    };
}

function CheckBoxWithLabel(props: CheckBoxWithLabelProps) {
    return (
        <FormControlLabel
            control={<Checkbox checked={props.checked} onChange={props.onChange} />}
            label={props.label}
        />
    );
}

type CheckBoxWithLabelProps = {
    label: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    checked: boolean;
};

export default React.memo(GeneralInfoStep);

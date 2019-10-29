import React from "react";
import { Moment } from "moment";
import { Card, CardContent } from "@material-ui/core";
import { DatePicker } from "d2-ui-components";
import { D2Api } from "d2-api";

import Project, { ProjectData } from "../../../models/Project";
import i18n from "../../../locales";

/* eslint-disable @typescript-eslint/no-var-requires */
const { TextField } = require("@dhis2/d2-ui-core");
const { FormBuilder, Validators } = require("@dhis2/d2-ui-forms");

interface Props {
    api: D2Api;
    project: Project;
    onChange: (project: Project) => void;
}

class GeneralInfoStep extends React.Component<Props> {
    onUpdateField = <K extends keyof ProjectData>(fieldName: K, newValue: ProjectData[K]) => {
        const { project, onChange } = this.props;
        const newProject = project.set(fieldName, newValue);
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
            getTextField("code", i18n.t("Code"), project.code),
            getDateField("startDate", i18n.t("Start Date"), project.startDate, {
                onUpdateField: this.onUpdateField,
            }),
            getDateField("endDate", i18n.t("End Date"), project.endDate, {
                onUpdateField: this.onUpdateField,
            }),
            getTextField("awardNumber", i18n.t("Award Number"), project.awardNumber),
            getTextField(
                "subsequentLettering",
                i18n.t("Subsequent Lettering"),
                project.subsequentLettering
            ),
            getTextField("speedKey", i18n.t("Speed Key"), project.speedKey),
        ];

        return (
            <Card>
                <CardContent>
                    <FormBuilder fields={fields} onUpdateField={this.onUpdateField} />
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
};

function getTextField(
    name: string,
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

type DateField = "startDate" | "endDate";

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

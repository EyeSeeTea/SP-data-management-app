import _ from "lodash";
import { D2Api } from "../types/d2-api";

import { RecurringValidator } from "./validators/RecurringValidator";
import { ActualValidator } from "./validators/ActualValidator";
import Project, { DataSetType } from "./Project";
import { DataValue, ValidationItem, ValidationResult } from "./validators/validator-common";
import { GlobalValidator } from "./validators/GlobalValidator";

interface Validators {
    actual: ActualValidator;
    recurring: RecurringValidator;
    global: GlobalValidator;
}

export class Validator {
    constructor(private period: string, private validators: Validators) {}

    static async build(
        api: D2Api,
        project: Project,
        dataSetType: DataSetType,
        period: string
    ): Promise<Validator> {
        const validators: Validators = {
            actual: await ActualValidator.build(api, project, dataSetType, period),
            recurring: await RecurringValidator.build(api, project, dataSetType, period),
            global: await GlobalValidator.build(api, project, dataSetType, period),
        };
        return new Validator(period, validators);
    }

    async validateDataValue(dataValue0: Omit<DataValue, "period">): Promise<ValidationResult> {
        const dataValue: DataValue = { ...dataValue0, period: this.period };
        const items: ValidationItem[] = _.concat(
            this.validators.actual.validate(dataValue),
            await this.validators.recurring.validate(dataValue)
        );
        return this.getValidationResult(items);
    }

    onSave(dataValue0: Omit<DataValue, "period">): Validator {
        const dataValue: DataValue = { ...dataValue0, period: this.period };
        const newValidators = {
            ...this.validators,
            global: this.validators.global.onSave(dataValue),
        };
        return new Validator(this.period, newValidators);
    }

    validateOnClose(): ValidationResult {
        const items: ValidationItem[] = this.validators.global.validate();
        return this.getValidationResult(items);
    }

    private getValidationResult(items: ValidationItem[]): ValidationResult {
        return _(items)
            .groupBy(([key, _msg]) => key)
            .mapValues(pairs => pairs.map(([_key, msg]) => msg))
            .value();
    }
}

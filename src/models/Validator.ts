import { RecurringValidator } from "./validators/RecurringValidator";
import { ActualValidator } from "./validators/ActualValidator";
import { D2Api } from "d2-api";
import _ from "lodash";

import Project, { DataSetType } from "./Project";
import { DataValue, ValidationItem, ValidationResult } from "./validators/validator-common";

interface Validators {
    actual: ActualValidator;
    recurring: RecurringValidator;
}

export class Validator {
    constructor(private validators: Validators) {}

    static async build(
        api: D2Api,
        project: Project,
        dataSetType: DataSetType,
        period: string
    ): Promise<Validator> {
        const validators = {
            actual: await ActualValidator.build(api, project, dataSetType, period),
            recurring: await RecurringValidator.build(api, project, dataSetType, period),
        };
        return new Validator(validators);
    }

    async validateDataValue(dataValue: DataValue): Promise<ValidationResult> {
        const items: ValidationItem[] = _.concat(
            this.validators.actual.validate(dataValue),
            this.validators.recurring.validate(dataValue)
        );

        return _(items)
            .groupBy(([key, _msg]) => key)
            .mapValues(pairs => pairs.map(([_key, msg]) => msg))
            .value();
    }
}

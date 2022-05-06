import i18n from "../../locales";
import { Id } from "../../types/d2-api";
import { Config } from "../Config";
import { toFloat, DataValue, ValidationItem } from "./validator-common";

/*
    Check that benefit data values meet these conditions:

        - Float value is zero or positive.
        - Float value has 5 or less decimals parts.
*/

interface Data {
    benefitDataElementsIds: Set<Id>;
}

export class BenefitValidator {
    constructor(private data: Data) {}

    static async build(config: Config): Promise<BenefitValidator> {
        const benefitDataElementsIds = new Set(
            config.dataElements.filter(de => de.peopleOrBenefit === "benefit").map(de => de.id)
        );
        return new BenefitValidator({ benefitDataElementsIds });
    }

    validate(dataValue: DataValue): ValidationItem[] {
        const { benefitDataElementsIds } = this.data;
        const value = toFloat(dataValue.value);
        const isABenefitDataElement = benefitDataElementsIds.has(dataValue.dataElementId);

        if (!isABenefitDataElement) {
            return [];
        } else if (value < 0) {
            const msg = i18n.t("Benefit value should be positive ({{value}})", { value });
            return [["error", msg]];
        } else if (value > 0 && decimalsOf(dataValue.value) > 5) {
            const msg = i18n.t("Benefit value should have 5 or less decimal places ({{value}})", {
                value,
            });
            return [["error", msg]];
        } else {
            return [];
        }
    }
}

function decimalsOf(s: string): number {
    const decimalPart = s.split(".")[1] || "";
    return decimalPart.length;
}

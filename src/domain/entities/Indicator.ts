import _ from "lodash";
import { Config } from "../../models/Config";
import { DataElement } from "./DataElement";
import { Struct } from "./generic/Struct";
import { IndicatorCategory, IndicatorType } from "./IndicatorType";
import { Code, Id, NamedRef } from "./Ref";

interface IndicatorAttrs extends NamedRef {
    code: Code;
    denominator: IndicatorFormula;
    numerator: IndicatorFormula;
    shortName: string;
    type: IndicatorType;
    groupName: string;
}

export const COST_BENEFIT_NAME = "Cost / Benefit";
export const TARGET_ACTUAL_NAME = "Actual / Target";

export class Indicator extends Struct<IndicatorAttrs>() {
    static buildIndicatorsByType(
        actualIndicatorId: Id,
        costBenefitIndicatorId: Id,
        dataElement: IndicatorDataElement,
        config: Config,
        allIndicatorsTypes: IndicatorType[]
    ): Indicator[] {
        const isBenefitType = dataElement.mainType.name === "benefit";

        const actualIndicator = this.create({
            id: actualIndicatorId,
            name: this.generateName(dataElement, TARGET_ACTUAL_NAME, "actual", allIndicatorsTypes),
            code: `${config.base.indicators.actualTargetPrefix}${dataElement.code}`,
            denominator: this.buildActualIndicatorFormula(
                dataElement,
                "denominator",
                config.categoryOptionCombos.target.id
            ),
            groupName: "People Target / Actual",
            numerator: this.buildActualIndicatorFormula(
                dataElement,
                "numerator",
                config.categoryOptionCombos.actual.id
            ),
            shortName: this.generateShortName(
                dataElement,
                TARGET_ACTUAL_NAME,
                "actual",
                allIndicatorsTypes
            ),
            type: this.generateIndicatorType(allIndicatorsTypes, "actual"),
        });

        const benefitIndicator =
            dataElement.pairedPeople && isBenefitType
                ? this.create({
                      id: costBenefitIndicatorId,
                      name: this.generateName(
                          dataElement,
                          COST_BENEFIT_NAME,
                          "benefit",
                          allIndicatorsTypes
                      ),
                      code: `${config.base.indicators.costBenefitPrefix}${dataElement.code}`,
                      denominator: this.buildBenefitIndicatorFormula(
                          dataElement,
                          "denominator",
                          config.categoryOptionCombos.actual.id,
                          config.categoryOptionCombos.newMale.id,
                          config.categoryOptionCombos.newFemale.id
                      ),
                      groupName: "Cost / Benefit",
                      numerator: this.buildBenefitIndicatorFormula(
                          dataElement,
                          "numerator",
                          config.categoryOptionCombos.actual.id,
                          config.categoryOptionCombos.newMale.id,
                          config.categoryOptionCombos.newFemale.id
                      ),
                      shortName: this.generateShortName(
                          dataElement,
                          COST_BENEFIT_NAME,
                          "benefit",
                          allIndicatorsTypes
                      ),
                      type: this.generateIndicatorType(allIndicatorsTypes, "benefit"),
                  })
                : undefined;

        return _([actualIndicator, benefitIndicator]).compact().value();
    }

    static buildBenefitIndicatorFormula(
        dataElement: IndicatorDataElement,
        typeFormula: IndicatorFormulaPosition,
        targetComboId: Id,
        newMale: Id,
        newFemale: Id
    ): IndicatorFormula {
        return {
            description: typeFormula === "numerator" ? "Benefits" : "Number of people",
            formula: this.buildFormula(typeFormula, dataElement, targetComboId, newMale, newFemale),
        };
    }

    private static buildFormula(
        typeFormula: IndicatorFormulaPosition,
        dataElement: IndicatorDataElement,
        targetComboId: Id,
        newMale: Id,
        newFemale: Id
    ): string {
        if (typeFormula === "numerator") {
            return `#{${dataElement.id}.*.${targetComboId}}`;
        } else if (typeFormula === "denominator" && dataElement.pairedPeople) {
            return `#{${dataElement.pairedPeople.id}.${newMale}.${targetComboId}} + #{${dataElement.pairedPeople.id}.${newFemale}.${targetComboId}}`;
        } else {
            throw Error(`Cannot build formula for ${typeFormula} in ${dataElement.id}`);
        }
    }

    private static buildActualIndicatorFormula(
        dataElement: IndicatorDataElement,
        typeFormula: IndicatorFormulaPosition,
        categoryComboId: Id
    ): IndicatorFormula {
        return {
            description: typeFormula === "numerator" ? "Actual" : "Target",
            formula: `#{${dataElement.id}.*.${categoryComboId}}`,
        };
    }

    private static generateIndicatorType(
        allIndicatorsTypes: IndicatorType[],
        category: IndicatorCategory
    ): IndicatorType {
        const indicatorTypeInfo = this.getIndicatorTypeByCategory(allIndicatorsTypes, category);
        return indicatorTypeInfo;
    }

    private static getIndicatorTypeByCategory(
        allIndicatorsTypes: IndicatorType[],
        category: IndicatorCategory
    ): IndicatorType {
        const indicatorTypeInfo = allIndicatorsTypes.find(
            indicatorType => indicatorType.category === category
        );
        if (!indicatorTypeInfo) throw Error(`Cannot found indicator type for: ${category}`);

        return indicatorTypeInfo;
    }

    private static generateName(
        dataElement: IndicatorDataElement,
        indicatorName: string,
        category: IndicatorCategory,
        allIndicatorsTypes: IndicatorType[]
    ): string {
        const indicatorTypeInfo = this.getIndicatorTypeByCategory(allIndicatorsTypes, category);
        return `${dataElement.name} ${indicatorName} (${indicatorTypeInfo.symbol})`;
    }

    private static generateShortName(
        dataElement: IndicatorDataElement,
        indicatorName: string,
        category: IndicatorCategory,
        allIndicatorsTypes: IndicatorType[]
    ): string {
        const indicatorTypeInfo = this.getIndicatorTypeByCategory(allIndicatorsTypes, category);
        return `${dataElement.code} ${indicatorName} (${indicatorTypeInfo.symbol})`;
    }
}

type IndicatorFormula = { description: string; formula: Formula };
export type IndicatorDataElement = Pick<
    DataElement,
    "id" | "name" | "code" | "mainType" | "pairedPeople"
>;

type IndicatorFormulaPosition = "numerator" | "denominator";
export type Formula = string;

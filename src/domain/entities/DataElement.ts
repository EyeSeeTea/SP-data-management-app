import _ from "lodash";

import { Config } from "../../models/Config";
import { PeopleOrBenefit } from "../../models/dataElementsSet";
import { Maybe } from "../../types/utils";
import { Struct } from "./generic/Struct";
import { Indicator, IndicatorDataElement } from "./Indicator";
import { IndicatorType } from "./IndicatorType";
import { Code, Id, NamedRef, Ref } from "./Ref";
import { Sector } from "./Sector";

export interface DataElementAttrs extends NamedRef {
    code: Code;
    countingMethod: Maybe<string>;
    description: string;
    disaggregation: Maybe<Ref>;
    extraInfo: Maybe<string>;
    extraSectors: Sector[];
    formName: string;
    indicators: Indicator[];
    indicatorType: NamedRef & { shortName: string; code: Code };
    mainSector: Sector;
    mainType: MainType;
    pairedPeople: Maybe<Ref & { code: Code }>;
    shortName: string;
}

export class DataElement extends Struct<DataElementAttrs>() {
    static buildDescription(code: string, name: string): string {
        return `${code} - ${name}`;
    }

    static buildFormName(code: string, name: string): string {
        return `[${code}] ${name}`;
    }

    static buildIndicators(
        dataElement: IndicatorDataElement,
        actualIndicatorId: Id,
        costBenefitIndicatorId: Id,
        metadataConfig: Config,
        allIndicatorsTypes: IndicatorType[]
    ): Indicator[] {
        return Indicator.buildIndicatorsByType(
            actualIndicatorId,
            costBenefitIndicatorId,
            dataElement,
            metadataConfig,
            allIndicatorsTypes
        );
    }

    static buildExtraInfo(description: Maybe<string>, external: Maybe<string>): string {
        const externalPart = external ? `Externals: ${external}` : "Externals: -";
        const descriptionPart = description ? description : "";
        return `${externalPart}\n${descriptionPart}`;
    }

    static buildDisaggregation(
        mainType: PeopleOrBenefit,
        benefitDisaggregation: Maybe<string>,
        metadataConfig: Config
    ): Maybe<Ref> {
        const disaggregation = this.getDisaggregationByMainType(
            mainType,
            benefitDisaggregation,
            metadataConfig
        );
        return disaggregation;
    }

    private static getDisaggregationByMainType(
        mainType: PeopleOrBenefit,
        benefitCategoryComboName: Maybe<string>,
        metadataConfig: Config
    ): Maybe<Ref> {
        if (mainType === "benefit" && benefitCategoryComboName) {
            const benefitDisaggregation = _(metadataConfig.categoryCombos).find(categoryCombo => {
                return categoryCombo.displayName === benefitCategoryComboName;
            });
            if (!benefitDisaggregation) {
                throw Error(`Cannot found benefit dissagregation: ${benefitCategoryComboName}`);
            }
            return benefitDisaggregation;
        } else if (mainType === "people") {
            return metadataConfig.categoryCombos.genderNewRecurring;
        } else {
            return undefined;
        }
    }

    static getSectorInfo(sectorName: string, metadataConfig: Config): Sector {
        const sector = metadataConfig.sectors.find(
            sector => sector.displayName.toLowerCase() === sectorName.toLowerCase()
        );
        if (!sector) throw Error(`Cannot find sector with name: ${sectorName}`);
        return {
            ...sector,
            name: sector.displayName,
            code: sector.code,
            shortName: sector.shortName,
        };
    }

    static getCrossSectorsCodes(crossSector: StringSeparatedByComma, isSerie: boolean): Code[] {
        return crossSector
            ? _(crossSector)
                  .split(", ")
                  .map(value => {
                      const result = isSerie ? `Series ${value.trim()}` : value.trim();
                      return result;
                  })
                  .compact()
                  .value()
            : [];
    }

    static buildShortName(code: string, name: string): string {
        return `[${code}] - ${name.substring(0, 30)}`;
    }
}

type StringSeparatedByComma = string;

export type MainType = { name: PeopleOrBenefit; sector: Sector };

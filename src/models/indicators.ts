import _ from "lodash";
import { Config } from "./Config";
import { SelectedPick, D2IndicatorSchema } from "../types/d2-api";

type DataElement = { code: string };

type Indicator = SelectedPick<D2IndicatorSchema, { id: true; code: true }>;

export function getActualTargetIndicators(
    config: Config,
    dataElements: Array<DataElement>
): Indicator[] {
    return getIndicators(config, dataElements, config.base.indicators.actualTargetPrefix);
}

export function getCostBenefitIndicators(
    config: Config,
    dataElements: Array<DataElement>
): Indicator[] {
    return getIndicators(config, dataElements, config.base.indicators.costBenefitPrefix);
}

function getIndicators(
    config: Config,
    dataElements: Array<{ code: string }>,
    codePrefix: string
): Indicator[] {
    const indicatorsByCode = _.keyBy(config.indicators, indicator => indicator.code);

    return _(dataElements)
        .map(de => {
            const indicatorCode = codePrefix + de.code;
            const indicator = _(indicatorsByCode).get(indicatorCode, undefined);
            if (indicator) {
                return indicator;
            } else {
                const msg = `Indicator ${indicatorCode} not found for data element ${de.code}`;
                console.error(msg);
                return null;
            }
        })
        .compact()
        .value();
}

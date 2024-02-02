import _ from "lodash";

import { D2Api } from "../../types/d2-api";
import { Id } from "../../domain/entities/Ref";
import { promiseMap } from "../../migrations/utils";
import { Indicator } from "../../domain/entities/Indicator";
import { getImportModeFromOptions, SaveOptions } from "../SaveOptions";

export class D2Indicator {
    constructor(private api: D2Api) {}

    async save(
        indicatorsIds: Id[],
        indicators: Indicator[],
        options: SaveOptions
    ): Promise<object> {
        const indicatorsImported = await promiseMap(
            _.chunk(indicatorsIds, 100),
            async indicatorIds => {
                const response = await this.api.models.indicators
                    .get({
                        fields: { $owner: true },
                        filter: { id: { in: indicatorIds } },
                        paging: false,
                    })
                    .getData();

                const postIndicators = indicatorIds.map(indicatorId => {
                    const existingRecord = response.objects.find(
                        d2Record => d2Record.id === indicatorId
                    );
                    const indicator = indicators.find(indicator => indicator.id === indicatorId);
                    if (!indicator) {
                        throw Error(`Cannot find indicator ${indicatorId}`);
                    }

                    return {
                        ...(existingRecord || {}),
                        id: indicator.id,
                        name: indicator.name,
                        code: indicator.code,
                        denominatorDescription: indicator.denominator.description,
                        denominator: indicator.denominator.formula,
                        numerator: indicator.numerator.formula,
                        numeratorDescription: indicator.numerator.description,
                        shortName: indicator.shortName,
                        indicatorType: { id: indicator.type.id },
                    };
                });

                const d2Response = await this.api.metadata
                    .post(
                        { indicators: postIndicators },
                        { importMode: getImportModeFromOptions(options.post) }
                    )
                    .getData();
                if (options.post) {
                    console.info("indicators", d2Response.stats);
                }
                return postIndicators;
            }
        );
        return _(indicatorsImported).flatten().value();
    }
}

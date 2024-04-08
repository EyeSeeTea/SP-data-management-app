import _ from "lodash";

import { D2Api } from "../../types/d2-api";
import { IndicatorType } from "../../domain/entities/IndicatorType";
import { getId } from "../../utils/dhis2";
import { promiseMap } from "../../migrations/utils";
import { Id, Ref } from "../../domain/entities/Ref";
import { getImportModeFromOptions, SaveOptions } from "../SaveOptions";

export class D2IndicatorType {
    constructor(private api: D2Api) {}

    async get(): Promise<IndicatorType[]> {
        const response = await this.api.models.indicatorTypes
            .get({ fields: { id: true, name: true } })
            .getData();
        return response.objects.map((d2Indicator): IndicatorType => {
            return IndicatorType.create({
                id: d2Indicator.id,
                name: d2Indicator.name,
                category: IndicatorType.getCategoryFromName(d2Indicator.name),
                symbol: IndicatorType.getSymbolFromName(d2Indicator.name),
            });
        });
    }

    async save(
        indicatorsGroupsIds: Id[],
        indicatorsGroups: { id: Id; indicators: Ref[] }[],
        options: SaveOptions
    ): Promise<object> {
        const indicatorGroupsImported = await promiseMap(
            _.chunk(indicatorsGroupsIds, 100),
            async indicatorGroupIds => {
                const response = await this.api.models.indicatorGroups
                    .get({
                        fields: { $owner: true },
                        filter: { name: { in: indicatorGroupIds } },
                        paging: false,
                    })
                    .getData();

                const postIndicatorsGroups = indicatorGroupIds.map(indicatorGroupId => {
                    const existingRecord = response.objects.find(
                        d2Record => d2Record.name === indicatorGroupId
                    );
                    const indicatorGroup = indicatorsGroups.find(
                        indicatorGroup => indicatorGroup.id === indicatorGroupId
                    );
                    if (!indicatorGroup) {
                        throw Error(`Cannot find indicator group ${indicatorGroupId}`);
                    }

                    return {
                        ...(existingRecord || {}),
                        indicators: _(existingRecord?.indicators)
                            .concat(indicatorGroup.indicators)
                            .uniqBy(getId)
                            .value(),
                    };
                });

                const d2Response = await this.api.metadata
                    .post(
                        { indicatorGroups: postIndicatorsGroups },
                        { importMode: getImportModeFromOptions(options.post) }
                    )
                    .getData();
                if (options.post) {
                    console.info("indicatorGroups", d2Response.stats);
                }
                return postIndicatorsGroups;
            }
        );

        return _(indicatorGroupsImported).flatten().value();
    }
}

import _ from "lodash";

import { D2Api } from "../../types/d2-api";
import { Id, Identifiable } from "../../domain/entities/Ref";
import { Sector } from "../../domain/entities/Sector";
import { promiseMap } from "../../migrations/utils";
import { DataElementGroup } from "../DataElementGroup";
import { getId } from "../../utils/dhis2";
import { getImportModeFromOptions, SaveOptions } from "../SaveOptions";

export class D2DataElementGroup {
    constructor(private api: D2Api) {}

    async getByIdentifiables(identifiables: Identifiable[]): Promise<Sector[]> {
        const sectors = await promiseMap(_.chunk(identifiables, 50), async codesToFilter => {
            const data = await this.api.models.dataElementGroups
                .get({ fields: fields, filter: { identifiable: { in: codesToFilter } } })
                .getData();

            return data.objects.map(d2DataElementGroup => d2DataElementGroup);
        });

        return _(sectors).flatten().value();
    }

    async save(
        dataElementGroupsIds: Id[],
        dataElementGroups: DataElementGroup[],
        options: SaveOptions
    ): Promise<object> {
        const dataElementGroupsImported = await promiseMap(
            _.chunk(dataElementGroupsIds, 100),
            async dataElementGroupIds => {
                const response = await this.api.models.dataElementGroups
                    .get({
                        fields: { $owner: true },
                        filter: { id: { in: dataElementGroupIds } },
                        paging: false,
                    })
                    .getData();

                const postDataElementGroups = dataElementGroupIds.map(dataElementGroupId => {
                    const existingRecord = response.objects.find(
                        d2Record => d2Record.id === dataElementGroupId
                    );
                    const dataElementGroup = dataElementGroups.find(
                        dataElement => dataElement.id === dataElementGroupId
                    );
                    if (!dataElementGroup) {
                        throw Error(`Cannot find dataElementGroup ${dataElementGroupId}`);
                    }

                    return {
                        ...(existingRecord || {}),
                        dataElements: _(existingRecord?.dataElements)
                            .concat(dataElementGroup.dataElements)
                            .uniqBy(getId)
                            .value(),
                    };
                });

                const d2Response = await this.api.metadata
                    .post(
                        { dataElementGroups: postDataElementGroups },
                        { importMode: getImportModeFromOptions(options.post) }
                    )
                    .getData();

                if (options.post) {
                    console.info("dataElementGroups", d2Response.stats);
                }
                return postDataElementGroups;
            }
        );

        return _(dataElementGroupsImported).flatten().value();
    }
}

const fields = { id: true, name: true, code: true } as const;

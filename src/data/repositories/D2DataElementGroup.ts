import _ from "lodash";

import { D2Api } from "../../types/d2-api";
import { Code, Id, Ref } from "../../domain/entities/Ref";
import { promiseMap } from "../../migrations/utils";
import { DataElementGroup } from "../DataElementGroup";
import { getImportModeFromOptions, SaveOptions } from "../SaveOptions";
import { getId } from "../../utils/dhis2";
import { Identifiable } from "../Ref";
import { DataElement } from "../../domain/entities/DataElement";

export class D2DataElementGroup {
    constructor(private api: D2Api) {}

    async getByIdentifiables(identifiables: Identifiable[]): Promise<DataElementGroup[]> {
        const sectors = await promiseMap(_.chunk(identifiables, 50), async codesToFilter => {
            const data = await this.api.models.dataElementGroups
                .get({ fields: fields, filter: { identifiable: { in: codesToFilter } } })
                .getData();

            return data.objects.map(d2DataElementGroup => ({ ...d2DataElementGroup }));
        });

        return _(sectors).flatten().value();
    }

    async save(
        dataElementGroupsIds: Id[],
        dataElementGroups: DataElementGroup[],
        dataElements: DataElement[],
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

                    const idsToDelete = existingRecord
                        ? this.getDataElementsToDeleteFromSeries(
                              {
                                  name: existingRecord.name,
                                  dataElements: existingRecord.dataElements,
                              },
                              dataElements
                          )
                        : [];

                    const mergeDataElements = _(existingRecord?.dataElements || [])
                        .concat(dataElementGroup.dataElements)
                        .uniqBy(getId)
                        .value();

                    return {
                        ...(existingRecord || {}),
                        id: dataElementGroup.id,
                        name: dataElementGroup.name,
                        code: dataElementGroup.code,
                        dataElements:
                            idsToDelete.length > 0
                                ? mergeDataElements.filter(
                                      dataElement => !idsToDelete.includes(dataElement.id)
                                  )
                                : mergeDataElements,
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

    private getDataElementsToDeleteFromSeries(
        dataElementGroup: { name: string; dataElements: Ref[] },
        dataElements: DataElement[]
    ): Id[] {
        if (!dataElementGroup.name.startsWith("Series ")) return [];
        const allSeries = dataElements.flatMap(dataElement => dataElement.extraSectors);
        const currentSerie = allSeries.find(serie => serie.name === dataElementGroup.name);
        if (!currentSerie) return [];
        const dataElementsInSerie = _(dataElements)
            .map(dataElement => {
                const isCurrentSerie = dataElement.extraSectors.find(
                    es => es.name === currentSerie.name
                );

                if (isCurrentSerie) return undefined;
                return dataElement;
            })
            .compact()
            .value();

        const deTomRemove = _(dataElementsInSerie)
            .map(dataElement => {
                const isInOtherSerie = dataElementGroup.dataElements.find(
                    deInGroup => deInGroup.id === dataElement.id
                );
                if (!isInOtherSerie) return undefined;
                return dataElement.id;
            })
            .compact()
            .value();
        return deTomRemove;
    }

    async getByCode(code: Code): Promise<DataElementGroup> {
        const response = await this.getByIdentifiables([code]);
        const dataElementGroup = response[0];
        if (!dataElementGroup) throw Error(`Cannot find DataElementGroup: ${code}`);
        return dataElementGroup;
    }

    async remove(dataElementGroups: DataElementGroup[]): Promise<void> {
        await this.api.metadata
            .post(
                {
                    dataElementGroups: dataElementGroups.map(dataElementGroup => {
                        return { id: dataElementGroup.id };
                    }),
                },
                {
                    importStrategy: "DELETE",
                }
            )
            .getData();
    }
}

const fields = { id: true, name: true, code: true, shortName: true, dataElements: true } as const;

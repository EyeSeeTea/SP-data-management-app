import _ from "lodash";

import { AttributeValue } from "../../domain/entities/AttributeValue";
import { DataElement } from "../../domain/entities/DataElement";
import { DataElementGroup } from "../../domain/entities/DataElementGroup";
import { Indicator } from "../../domain/entities/Indicator";
import { Id, Ref } from "../../domain/entities/Ref";
import { promiseMap } from "../../migrations/utils";
import { Config } from "../../models/Config";
import { D2Api } from "../../types/d2-api";
import { Maybe } from "../../types/utils";
import { getId } from "../../utils/dhis2";
import { getImportModeFromOptions, SaveOptions } from "../SaveOptions";

export class D2DataElement {
    constructor(private api: D2Api, private config: Config) {}

    async save(ids: Id[], dataElements: DataElement[], options: SaveOptions): Promise<object> {
        const dataElementsImported = await promiseMap(_.chunk(ids, 100), async dataElementIds => {
            const response = await this.api.models.dataElements
                .get({
                    fields: { $owner: true },
                    filter: { id: { in: dataElementIds } },
                    paging: false,
                })
                .getData();

            const postDataElements = dataElementIds.map(dataElementId => {
                const existingD2DataElement = response.objects.find(
                    d2DataElement => d2DataElement.id === dataElementId
                );
                const dataElement = dataElements.find(
                    dataElement => dataElement.id === dataElementId
                );
                if (!dataElement) {
                    throw Error(`Cannot find dataElement ${dataElementId}`);
                }

                const defaultAggregationType = "SUM" as const;
                const defaultDomainType: "AGGREGATE" | "TRACKER" = "AGGREGATE";
                const valueType: "INTEGER_ZERO_OR_POSITIVE" | "NUMBER" =
                    dataElement.mainType.name === "benefit" ? "NUMBER" : "INTEGER_ZERO_OR_POSITIVE";

                return {
                    ...(existingD2DataElement || {}),
                    aggregationType: defaultAggregationType,
                    attributeValues: this.buildAttributes(dataElement, this.config),
                    categoryCombo: dataElement.disaggregation
                        ? { id: dataElement.disaggregation.id }
                        : undefined,
                    code: dataElement.code,
                    description: dataElement.description,
                    domainType: defaultDomainType,
                    formName: dataElement.formName,
                    id: dataElement.id,
                    name: dataElement.name,
                    shortName: dataElement.shortName,
                    valueType: valueType,
                };
            });

            const d2Response = await this.api.metadata
                .post(
                    { dataElements: postDataElements },
                    { importMode: getImportModeFromOptions(options.post) }
                )
                .getData();

            if (options.post) {
                console.info("dataElements", d2Response.stats);
            }
            return postDataElements;
        });

        return _(dataElementsImported).flatten().value();
    }

    extractMetadata(dataElements: DataElement[]) {
        const ids = dataElements.map(getId);
        const dataElementGroups = this.buildDataElementGroups(dataElements);
        const dataElementGroupsIds = dataElementGroups.map(getId);
        const { indicatorsIds, indicators } = this.buildIndicators(dataElements);
        const { indicatorsGroupsIds, indicatorsGroups } = this.buildIndicatorsGroups(dataElements);
        return {
            ids,
            dataElementGroups,
            dataElementGroupsIds,
            indicatorsIds,
            indicators,
            indicatorsGroupsIds,
            indicatorsGroups,
        };
    }

    private buildAttributes(dataElement: DataElement, metadataConfig: Config): AttributeValue[] {
        const pairedDataElementAttribute = this.generateAttributeValue(
            metadataConfig.attributes.pairedDataElement.id,
            dataElement.pairedPeople?.code
        );

        const sectorAttribute = this.generateAttributeValue(
            metadataConfig.attributes.mainSector.id,
            dataElement.mainSector.code
        );

        const extraInfoAttribute = this.generateAttributeValue(
            metadataConfig.attributes.extraDataElement.id,
            dataElement.extraInfo
        );

        const countingMethodAttribute = this.generateAttributeValue(
            metadataConfig.attributes.countingMethod.id,
            dataElement.countingMethod
        );

        return _([
            countingMethodAttribute,
            extraInfoAttribute,
            pairedDataElementAttribute,
            sectorAttribute,
        ])
            .compact()
            .value();
    }

    private generateAttributeValue(id: Id, value: Maybe<string>): Maybe<AttributeValue> {
        return value ? { attribute: { id: id }, value: value } : undefined;
    }

    private buildIndicatorsGroups(dataElements: DataElement[]): {
        indicatorsGroupsIds: Id[];
        indicatorsGroups: { id: Id; indicators: Ref[] }[];
    } {
        const allIndicators = dataElements.flatMap(dataElement => dataElement.indicators);
        const indicatorsGroups = _(allIndicators)
            .groupBy(indicator => indicator.groupName)
            .toPairs()
            .map(([indicatorTypeId, indicators]) => {
                return {
                    id: indicatorTypeId,
                    indicators: indicators.map(indicator => ({ id: indicator.id })),
                };
            })
            .value();

        const indicatorsGroupsIds = indicatorsGroups.map(getId);

        return { indicatorsGroups: indicatorsGroups, indicatorsGroupsIds: indicatorsGroupsIds };
    }

    private buildIndicators(dataElements: DataElement[]): {
        indicatorsIds: Id[];
        indicators: Indicator[];
    } {
        const ids = _(dataElements)
            .flatMap(dataElement => dataElement.indicators.map(indicator => indicator.id))
            .value();

        return {
            indicatorsIds: ids,
            indicators: _(dataElements)
                .flatMap(dataElement => dataElement.indicators)
                .value(),
        };
    }

    private buildDataElementGroups(dataElements: DataElement[]): DataElementGroup[] {
        const mainSectorGroup = _(dataElements)
            .groupBy(dataElement => dataElement.mainSector.id)
            .toPairs()
            .map(([dataElementGroupId, dataElements]) => {
                return {
                    id: dataElementGroupId,
                    dataElements: dataElements.map(dataElement => ({ id: dataElement.id })),
                };
            })
            .value();

        const mainTypeGroup = _(dataElements)
            .groupBy(dataElement => dataElement.mainType.sector.id)
            .toPairs()
            .map(([dataElementGroupId, dataElements]) => {
                return {
                    id: dataElementGroupId,
                    dataElements: dataElements.map(dataElement => ({ id: dataElement.id })),
                };
            })
            .value();

        const extraSectorGroup = _(dataElements)
            .flatMap(dataElement => {
                const extraSectorIds = dataElement.extraSectors.map(extraSector => extraSector.id);
                return extraSectorIds.map(sectorId => {
                    return { id: dataElement.id, extraSectorId: sectorId };
                });
            })
            .groupBy(dataElement => dataElement.extraSectorId)
            .toPairs()
            .map(([dataElementGroupId, dataElements]) => {
                return {
                    id: dataElementGroupId,
                    dataElements: dataElements.map(dataElement => ({ id: dataElement.id })),
                };
            })
            .value();

        const indicatorTypeGroup = _(dataElements)
            .groupBy(dataElement => dataElement.indicatorType.id)
            .toPairs()
            .map(([dataElementGroupId, dataElements]) => {
                return {
                    id: dataElementGroupId,
                    dataElements: dataElements.map(dataElement => ({ id: dataElement.id })),
                };
            })
            .value();

        return [...mainSectorGroup, ...mainTypeGroup, ...extraSectorGroup, ...indicatorTypeGroup];
    }
}

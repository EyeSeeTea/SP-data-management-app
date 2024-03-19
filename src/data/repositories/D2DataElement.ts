import _ from "lodash";

import { AttributeValue } from "../AttributeValue";
import { DataElement } from "../../domain/entities/DataElement";
import { DataElementGroup } from "../../data/DataElementGroup";
import { COST_BENEFIT_NAME, Indicator, TARGET_ACTUAL_NAME } from "../../domain/entities/Indicator";
import { Code, Id, Ref } from "../../domain/entities/Ref";
import { promiseMap } from "../../migrations/utils";
import { Config } from "../../models/Config";
import {
    D2Api,
    PartialPersistedModel,
    D2DataElement as D2ApiDataElement,
    MetadataPick,
} from "../../types/d2-api";
import { Maybe } from "../../types/utils";
import { getId } from "../../utils/dhis2";
import { getImportModeFromOptions, SaveOptions } from "../SaveOptions";
import { indicatorTypes, peopleOrBenefitList } from "../../models/dataElementsSet";
import { IndicatorType } from "../../domain/entities/IndicatorType";
import { D2Indicator, D2IndicatorFields } from "./D2Indicator";
import { ExportOptions } from "../../domain/repositories/ExportDataElementRepository";

export class D2DataElement {
    d2Indicator: D2Indicator;
    constructor(private api: D2Api, private config: Config) {
        this.d2Indicator = new D2Indicator(api);
    }

    async getByCodes(codes: Code[]): Promise<DataElement[]> {
        return this.getDataElementsInChunks(codes, "code");
    }

    private async getDataElementsInChunks(
        values: string[],
        fieldName: string
    ): Promise<DataElement[]> {
        const dataElementsImported = await promiseMap(
            _.chunk(values, 100),
            async dataElementIds => {
                const response = await this.api.models.dataElements
                    .get({
                        fields: dataElementFields,
                        filter: { [fieldName]: { in: dataElementIds } },
                        paging: false,
                    })
                    .getData();

                const actualTargetCodes = response.objects.map(d2DataElement => {
                    return `${this.config.base.indicators.actualTargetPrefix}${d2DataElement.code}`;
                });

                const benefitCodes = response.objects.map(d2DataElement => {
                    return `${this.config.base.indicators.costBenefitPrefix}${d2DataElement.code}`;
                });

                const indicatorResponse = await this.d2Indicator.getByCodes([
                    ...actualTargetCodes,
                    ...benefitCodes,
                ]);

                const indicatorsByKeys = _.keyBy(indicatorResponse, indicator => indicator.code);

                const dataElements = _(response.objects)
                    .map(d2DataElement => this.buildDataElement(d2DataElement, indicatorsByKeys))
                    .compact()
                    .value();

                return dataElements;
            }
        );

        return _(dataElementsImported).flatten().value();
    }

    async getByIds(ids: Id[]): Promise<DataElement[]> {
        return this.getDataElementsInChunks(ids, "id");
    }

    async save(ids: Id[], dataElements: DataElement[], options: SaveOptions): Promise<object> {
        const dataElementsImported = await promiseMap(_.chunk(ids, 100), async dataElementIds => {
            const response = await this.api.models.dataElements
                .get({
                    fields: { $owner: true },
                    filter: { id: { in: dataElementIds } },
                    paging: false,
                })
                .getData();

            const postDataElements = dataElementIds.map(
                (dataElementId): PartialPersistedModel<D2ApiDataElement> => {
                    const existingD2DataElement = response.objects.find(
                        d2DataElement => d2DataElement.id === dataElementId
                    );
                    const dataElement = dataElements.find(
                        dataElement => dataElement.id === dataElementId
                    );
                    if (!dataElement) {
                        throw Error(`Cannot find dataElement ${dataElementId}`);
                    }

                    const defaultAggregationType: D2ApiDataElement["aggregationType"] = "SUM";
                    const defaultDomainType: "AGGREGATE" | "TRACKER" = "AGGREGATE";
                    const valueType: "INTEGER_ZERO_OR_POSITIVE" | "NUMBER" =
                        dataElement.mainType.name === "benefit"
                            ? "NUMBER"
                            : "INTEGER_ZERO_OR_POSITIVE";

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
                        zeroIsSignificant: true,
                    };
                }
            );

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

    extractMetadata(dataElements: DataElement[], options: ExportOptions) {
        const { ignoreGroups } = options;
        const ids = dataElements.map(getId);
        const dataElementGroups = ignoreGroups ? [] : this.buildDataElementGroups(dataElements);
        const dataElementGroupsIds = dataElementGroups.map(getId);
        const existingIndicators = this.buildIndicators(dataElements.filter(de => de.existing));
        const newIndicators = this.buildIndicators(dataElements.filter(de => !de.existing));
        const { indicatorsGroupsIds, indicatorsGroups } = this.buildIndicatorsGroups(
            dataElements,
            ignoreGroups
        );
        return {
            ids,
            dataElementGroups,
            dataElementGroupsIds,
            existingIndicators,
            newIndicators,
            indicatorsGroupsIds,
            indicatorsGroups,
        };
    }

    private buildAttributes(dataElement: DataElement, metadataConfig: Config): AttributeValue[] {
        const attributes = metadataConfig.attributes;
        const pairedDataElementAttribute = this.generateAttributeValue(
            attributes.pairedDataElement.id,
            dataElement.pairedPeople?.code
        );

        const sectorAttribute = this.generateAttributeValue(
            attributes.mainSector.id,
            dataElement.mainSector.code
        );

        const extraInfoAttribute = this.generateAttributeValue(
            attributes.extraDataElement.id,
            dataElement.extraInfo
        );

        const countingMethodAttribute = this.generateAttributeValue(
            attributes.countingMethod.id,
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

    private buildIndicatorsGroups(
        dataElements: DataElement[],
        ignoreGroups: boolean
    ): {
        indicatorsGroupsIds: Id[];
        indicatorsGroups: { id: Id; indicators: Ref[] }[];
    } {
        if (ignoreGroups) return { indicatorsGroups: [], indicatorsGroupsIds: [] };
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
        const mainSectorGroups = this.buildSectorsGroups(dataElements);

        const mainTypeGroups = this.buildMainTypes(dataElements);

        const extraSectorsGroups = this.buildExtraSectorsGroups(dataElements);

        const allIndicatorTypeGroups = _(dataElements)
            .map(dataElement =>
                dataElement.indicatorType.id ? dataElement.indicatorType : undefined
            )
            .compact()
            .uniqBy(indicator => indicator.id)
            .keyBy(indicator => indicator.id)
            .value();

        const indicatorTypeGroup = _.isEmpty(allIndicatorTypeGroups)
            ? []
            : _(dataElements)
                  .groupBy(dataElement => dataElement.indicatorType.id)
                  .toPairs()
                  .map(([dataElementGroupId, dataElements]) => {
                      const indicatorTypeInfo = allIndicatorTypeGroups[dataElementGroupId];
                      return {
                          ...indicatorTypeInfo,
                          dataElements: dataElements.map(dataElement => ({ id: dataElement.id })),
                      };
                  })
                  .value();

        return [
            ...mainSectorGroups,
            ...mainTypeGroups,
            ...extraSectorsGroups,
            ...indicatorTypeGroup,
        ];
    }

    private buildExtraSectorsGroups(dataElements: DataElement[]) {
        const allExtraSectorGroups = _(dataElements)
            .flatMap(dataElement => {
                const extraSector = dataElement.extraSectors.map(extraSector => extraSector);
                return extraSector;
            })
            .uniqBy(extraSector => extraSector.id)
            .keyBy(extraSector => extraSector.id)
            .value();

        if (_.isEmpty(allExtraSectorGroups)) return [];

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
                const extraSectorDetails = allExtraSectorGroups[dataElementGroupId];
                return {
                    ...extraSectorDetails,
                    dataElements: dataElements.map(dataElement => ({ id: dataElement.id })),
                };
            })
            .value();
        return extraSectorGroup;
    }

    private buildMainTypes(dataElements: DataElement[]) {
        const allMainTypes = _(dataElements)
            .map(dataElement =>
                dataElement.mainType.sector.id ? dataElement.mainType.sector : undefined
            )
            .compact()
            .uniqBy(mainType => mainType.id)
            .keyBy(mainType => mainType.id)
            .value();

        if (_.isEmpty(allMainTypes)) return [];

        const mainTypeGroup = _(dataElements)
            .groupBy(dataElement => dataElement.mainType.sector.id)
            .toPairs()
            .map(([dataElementGroupId, dataElements]) => {
                const mainTypeInfo = allMainTypes[dataElementGroupId];
                return {
                    ...mainTypeInfo,
                    dataElements: dataElements.map(dataElement => ({ id: dataElement.id })),
                };
            })
            .value();

        return mainTypeGroup;
    }

    private buildSectorsGroups(dataElements: DataElement[]) {
        const allMainSectors = _(dataElements)
            .map(dataElement => (dataElement.mainSector.id ? dataElement.mainSector : undefined))
            .compact()
            .uniqBy(getId)
            .keyBy(sector => sector.id)
            .value();

        if (_.isEmpty(allMainSectors)) return [];

        const mainSectorGroup = _(dataElements)
            .groupBy(dataElement => dataElement.mainSector.id)
            .toPairs()
            .map(([dataElementGroupId, dataElements]) => {
                const mainSectorDetails = allMainSectors[dataElementGroupId];
                return {
                    ...mainSectorDetails,
                    dataElements: dataElements.map(dataElement => ({ id: dataElement.id })),
                };
            })
            .value();

        return mainSectorGroup;
    }

    private buildDataElement(
        d2DataElement: D2DataElementFields,
        indicators: Record<string, D2IndicatorFields>
    ): Maybe<DataElement> {
        const targetIndicator = indicators[`ACTUAL_TARGET_${d2DataElement.code}`];
        const costBenefitIndicator = indicators[`COST_BENEFIT_${d2DataElement.code}`];

        const attributes = this.config.attributes;
        const extraInfo = this.getAttributeValue(d2DataElement, attributes.extraDataElement.id);
        const pairedDataElement = this.getAttributeValue(
            d2DataElement,
            attributes.pairedDataElement.id
        );
        const countingMethod = this.getAttributeValue(d2DataElement, attributes.countingMethod.id);
        const mainSector = this.getMainSector(d2DataElement, this.config);
        const mainType = this.getMainType(d2DataElement);
        const indicatorType = this.getIndicatorType(d2DataElement);

        const extraSectors = _(d2DataElement.dataElementGroups)
            .map(dataElementGroup => {
                if (dataElementGroup.id === indicatorType.id) return undefined;
                if (dataElementGroup.id === mainSector.id) return undefined;
                if (dataElementGroup.id === mainType.sector.id) return undefined;
                return dataElementGroup;
            })
            .compact()
            .value();

        const actualIndicator = this.createIndicator(targetIndicator, TARGET_ACTUAL_NAME);
        const benefitIndicator = this.createIndicator(costBenefitIndicator, COST_BENEFIT_NAME);

        const dataElementIndicators = _([actualIndicator, benefitIndicator]).compact().value();

        return new DataElement({
            id: d2DataElement.id,
            code: d2DataElement.code,
            countingMethod: countingMethod,
            description: d2DataElement.description,
            disaggregation: d2DataElement.categoryCombo
                ? { id: d2DataElement.categoryCombo.id }
                : undefined,
            extraInfo: extraInfo,
            extraSectors: extraSectors,
            formName: d2DataElement.formName,
            indicators: dataElementIndicators,
            indicatorType: indicatorType,
            mainSector: { ...mainSector, name: mainSector.displayName },
            mainType: { name: mainType.name, sector: mainType.sector },
            pairedPeople: pairedDataElement ? { id: "", code: pairedDataElement } : undefined,
            shortName: d2DataElement.shortName,
            name: d2DataElement.name,
            existing: true,
        });
    }

    private createIndicator(targetIndicator: Maybe<D2IndicatorFields>, groupName: string) {
        if (!targetIndicator) return undefined;
        return Indicator.create({
            code: targetIndicator.code,
            id: targetIndicator.id,
            denominator: {
                description: targetIndicator.denominatorDescription,
                formula: targetIndicator.denominator,
            },
            numerator: {
                description: targetIndicator.numeratorDescription,
                formula: targetIndicator.numerator,
            },
            groupName: groupName,
            name: targetIndicator.name,
            shortName: targetIndicator.shortName,
            type: IndicatorType.create({
                category: IndicatorType.getCategoryFromName(targetIndicator.indicatorType.name),
                id: targetIndicator.indicatorType.id,
                name: targetIndicator.indicatorType.name,
                symbol: IndicatorType.getSymbolFromName(targetIndicator.indicatorType.name),
            }),
        });
    }

    private getIndicatorType(d2DataElement: D2DataElementFields) {
        const indicatorTypeDetails = _(indicatorTypes)
            .map(indicatorType => {
                const indicatorTypeCode =
                    indicatorType === "reportableSub" ? "REPORTABLE_SUB" : indicatorType;
                const dataElementGroup = d2DataElement.dataElementGroups.find(
                    dataElementGroup =>
                        dataElementGroup.code.toLowerCase() === indicatorTypeCode.toLowerCase()
                );
                if (!dataElementGroup) return undefined;
                return dataElementGroup;
            })
            .compact()
            .first();

        if (!indicatorTypeDetails) {
            throw Error(`Cannot find indicatorType for dataElement: ${d2DataElement.id}`);
        }

        return indicatorTypeDetails;
    }

    private getMainType(d2DataElement: D2DataElementFields) {
        const mainTypeDetails = _(peopleOrBenefitList)
            .map(mainType => {
                const dataElementGroup = d2DataElement.dataElementGroups.find(
                    dataElementGroup =>
                        dataElementGroup.code.toLowerCase() === mainType.toLowerCase()
                );
                if (!dataElementGroup) return undefined;
                return { name: mainType, sector: dataElementGroup };
            })
            .compact()
            .first();

        if (!mainTypeDetails || !mainTypeDetails.sector) {
            throw Error(`Cannot find mainType for dataElement: ${d2DataElement.id}`);
        }
        return mainTypeDetails;
    }

    private getAttributeValue(d2DataElement: D2DataElementFields, attributeId: Id): string {
        const attribute = d2DataElement.attributeValues.find(
            attribute => attributeId === attribute.attribute.id
        );
        return attribute?.value || "";
    }

    private getMainSector(d2DataElement: D2DataElementFields, config: Config) {
        const mainSectorCode = this.getAttributeValue(
            d2DataElement,
            config.attributes.mainSector.id
        );
        const mainSector = this.config.sectors.find(sector => sector.code === mainSectorCode);
        if (!mainSector) {
            throw Error(`Cannot find mainSector for dataElement: ${d2DataElement.id}`);
        }
        return mainSector;
    }
}

const dataElementFields = {
    attributeValues: { value: true, attribute: { id: true } },
    code: true,
    dataElementGroups: { id: true, code: true, name: true, shortName: true },
    description: true,
    id: true,
    name: true,
    categoryCombo: true,
    formName: true,
    shortName: true,
} as const;

type D2DataElementFields = MetadataPick<{
    dataElements: { fields: typeof dataElementFields };
}>["dataElements"][number];

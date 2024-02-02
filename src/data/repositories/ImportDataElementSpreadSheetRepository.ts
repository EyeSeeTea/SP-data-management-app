import _ from "lodash";
import excelToJson from "convert-excel-to-json";

import { D2Api } from "../../types/d2-api";
import { Config } from "../../models/Config";
import { PeopleOrBenefit, peopleOrBenefitList } from "../../models/dataElementsSet";
import { Maybe } from "../../types/utils";
import {
    ImportDataElement,
    ImportDataElementRepository,
} from "../../domain/repositories/ImportDataElementRepository";
import { DataElement } from "../../domain/entities/DataElement";
import { D2DataElementGroup } from "./D2DataElementGroup";
import { Code, Ref, Identifiable } from "../../domain/entities/Ref";
import { Sector } from "../../domain/entities/Sector";
import { D2IndicatorType } from "./D2IndicatorType";
import { IndicatorType } from "../../domain/entities/IndicatorType";

export class ImportDataElementSpreadSheetRepository implements ImportDataElementRepository {
    private d2DataElementGroup: D2DataElementGroup;
    private d2IndicatorType: D2IndicatorType;

    constructor(private api: D2Api, private config: Config) {
        this.d2DataElementGroup = new D2DataElementGroup(this.api);
        this.d2IndicatorType = new D2IndicatorType(this.api);
    }

    async import(path: string): Promise<ImportDataElement> {
        console.info("Reading excel file...");
        const dataElementsFromExcel = this.getDataElementFromSheet(path);
        console.info(`${dataElementsFromExcel.length} records found in excel`);

        const sectorCodes = this.getSectorIdentifiables(dataElementsFromExcel, this.config);

        console.info("Fetching sectors information...");
        const allSectors = await this.d2DataElementGroup.getByIdentifiables(sectorCodes);
        console.info(`${allSectors.length} sectors found`);

        console.info("Fetching indicators type...");
        const allIndicatorsTypes = await this.d2IndicatorType.get();

        const existingDataElements = this.generateDataElementsToImport(
            dataElementsFromExcel.filter(record => record.oldCode),
            allSectors,
            this.config,
            allIndicatorsTypes
        );
        console.info(`${existingDataElements.length} existing data elements`);

        const newDataElements = this.generateDataElementsToImport(
            dataElementsFromExcel.filter(record => !record.oldCode),
            allSectors,
            this.config,
            allIndicatorsTypes
        );
        console.info(`${newDataElements.length} new data elements`);

        return { newRecords: newDataElements, existingRecords: existingDataElements };
    }

    private generateDataElementsToImport(
        dataElementsFromExcel: DataElementExcel[],
        allSectors: Sector[],
        config: Config,
        indicatorsTypes: IndicatorType[]
    ): DataElement[] {
        const pairedDataElements = _(dataElementsFromExcel)
            .keyBy(record => record.code)
            .value();

        return _(dataElementsFromExcel)
            .map((excelRecord, index): DataElement => {
                const type = this.getDataElementType(excelRecord, index);

                const mainSector = this.getMainSector(allSectors, excelRecord, index);

                const series = this.getSeriesSector(
                    allSectors,
                    `Series ${excelRecord.series}`,
                    "Series",
                    index
                );

                const crossSectorSeriesCodes = excelRecord.crossSectorSeries
                    ? DataElement.getCrossSectorsCodes(excelRecord.crossSectorSeries, true)
                    : [];

                const crossSectorCodes = excelRecord.crossSectors
                    ? DataElement.getCrossSectorsCodes(excelRecord.crossSectors, false)
                    : [];

                const crossSeries = _(crossSectorSeriesCodes)
                    .map(crossSectorSerieCode => {
                        return this.getSeriesSector(
                            allSectors,
                            crossSectorSerieCode,
                            "Cross Sector Series",
                            index
                        );
                    })
                    .value();

                const crossSectors = _(crossSectorCodes)
                    .map(crossSectorSerieCode => {
                        return this.getSeriesSector(
                            allSectors,
                            crossSectorSerieCode,
                            "Cross Sector",
                            index
                        );
                    })
                    .value();

                const mainTypeSectorInfo = allSectors.find(
                    sector => sector.code.toLowerCase() === type.toLowerCase()
                );
                if (!mainTypeSectorInfo)
                    throw Error(`Cannot find mainType: ${type.toLocaleLowerCase()}`);

                const mainType: DataElement["mainType"] = {
                    name: type,
                    sector: mainTypeSectorInfo,
                };

                const indicatorType: DataElement["indicatorType"] = {
                    name: excelRecord.globalSub,
                    id:
                        allSectors.find(
                            sector =>
                                sector.code.toLowerCase() ===
                                excelRecord.globalSub.toLocaleLowerCase()
                        )?.id || "",
                };

                const pairedPeople = this.buildPairedPeople(excelRecord, pairedDataElements);
                const description = DataElement.buildDescription(
                    excelRecord.code,
                    excelRecord.name
                );
                const formName = DataElement.buildFormName(excelRecord.code, excelRecord.name);

                const dataElement = DataElement.create({
                    id: excelRecord.id,
                    code: excelRecord.code,
                    description: description,
                    formName: formName,
                    name: excelRecord.name,
                    mainSector: mainSector,
                    extraSectors: [series, ...crossSeries, ...crossSectors],
                    mainType: mainType,
                    disaggregation: DataElement.buildDisaggregation(
                        mainType.name,
                        excelRecord.benefitDisaggregation,
                        config
                    ),
                    indicatorType: indicatorType,
                    pairedPeople: pairedPeople,
                    extraInfo: DataElement.buildExtraInfo(
                        excelRecord.description,
                        excelRecord.external
                    ),
                    indicators: DataElement.buildIndicators(
                        {
                            id: excelRecord.id,
                            code: excelRecord.code,
                            mainType: mainType,
                            name: excelRecord.name,
                            pairedPeople: pairedPeople,
                        },
                        excelRecord.actualTargetIndicatorId,
                        excelRecord.costBenefitIndicatorId,
                        config,
                        indicatorsTypes
                    ),
                    shortName: DataElement.buildShortName(excelRecord.code, excelRecord.name),
                    countingMethod: excelRecord.countingMethod,
                });
                return dataElement;
            })
            .value();
    }

    private buildPairedPeople(
        excelRecord: DataElementExcel,
        pairedDataElements: Record<Code, DataElementExcel>
    ): Maybe<Ref & { code: string }> {
        if (!excelRecord.pairedPeople || !pairedDataElements[excelRecord.pairedPeople]) {
            return undefined;
        }
        return excelRecord.pairedPeople
            ? {
                  code: excelRecord.pairedPeople,
                  id: pairedDataElements[excelRecord.pairedPeople].id,
              }
            : undefined;
    }

    private getDataElementType(excelRecord: DataElementExcel, index: number): PeopleOrBenefit {
        const type = peopleOrBenefitList.find(
            record => record === excelRecord.peopleBenefit.toLowerCase()
        );
        if (!type) {
            throw Error(
                `Error in row ${index + 1}: Invalid value in column People/Benefit = ${
                    excelRecord.peopleBenefit
                }`
            );
        }
        return type;
    }

    private getSeriesSector(
        allSectors: Sector[],
        seriesName: string,
        columnName: string,
        index: number
    ) {
        const series = allSectors.find(
            sector => sector.name.toLowerCase() === seriesName.toLowerCase()
        );
        if (!series) {
            throw Error(
                `Error in row ${index + 1}: Invalid value in column ${columnName} = ${seriesName}`
            );
        }
        return series;
    }

    private getMainSector(allSectors: Sector[], excelRecord: DataElementExcel, rowNumber: number) {
        const mainSector = allSectors.find(
            sector => sector.name.toLowerCase() === excelRecord.sector.toLowerCase()
        );
        if (!mainSector) {
            throw Error(
                `Error in row ${rowNumber + 1}: Invalid value in column Sector = ${
                    excelRecord.sector
                }`
            );
        }
        return mainSector;
    }

    private getSectorIdentifiables(
        dataElementsFromExcel: DataElementExcel[],
        config: Config
    ): Identifiable[] {
        return _(dataElementsFromExcel)
            .flatMap(excelRecord => {
                const mainSectorCode = DataElement.getSectorInfo(excelRecord.sector, config);
                const crossSectorSeriesCodes = excelRecord.crossSectorSeries
                    ? DataElement.getCrossSectorsCodes(excelRecord.crossSectorSeries, true)
                    : [];
                const crossSectorCodes = excelRecord.crossSectors
                    ? DataElement.getCrossSectorsCodes(excelRecord.crossSectors, false)
                    : [];
                return [
                    mainSectorCode.code,
                    excelRecord.series ? `Series ${excelRecord.series}` : undefined,
                    excelRecord.globalSub.toUpperCase(),
                    ...crossSectorSeriesCodes,
                    ...crossSectorCodes,
                ];
            })
            .concat(config.base.dataElementGroups.benefit, config.base.dataElementGroups.people)
            .compact()
            .uniq()
            .value();
    }

    private getDataElementFromSheet(path: string): DataElementExcel[] {
        const result = excelToJson({
            sourceFile: path,
            header: { rows: 1 },
            columnToKey: {
                A: "sector",
                B: "oldCode",
                C: "code",
                D: "id",
                E: "actualTargetIndicatorId",
                F: "costBenefitIndicatorId",
                G: "name",
                H: "description",
                I: "globalSub",
                J: "peopleBenefit",
                K: "benefitDisaggregation",
                L: "series",
                M: "pairedPeople",
                N: "external",
                O: "countingMethod",
                P: "crossSectorSeries",
                Q: "crossSectors",
            },
            sheets: ["CreateUpdate"],
        });

        return result["CreateUpdate"] as unknown as DataElementExcel[];
    }
}

type DataElementExcel = {
    sector: string;
    oldCode: string;
    code: string;
    id: string;
    actualTargetIndicatorId: string;
    costBenefitIndicatorId: string;
    name: string;
    description: string;
    globalSub: string;
    peopleBenefit: string;
    benefitDisaggregation: string;
    series: string;
    pairedPeople: string;
    external: string;
    countingMethod: string;
    crossSectorSeries: string;
    crossSectors: string;
};

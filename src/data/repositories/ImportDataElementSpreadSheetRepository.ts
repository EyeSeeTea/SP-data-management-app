import _ from "lodash";
import xlsx from "xlsx";

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
import { getUid } from "../../utils/dhis2";

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
        const allSectorsSeries = await this.d2DataElementGroup.getByIdentifiables(sectorCodes);
        console.info(`${allSectorsSeries.length} sectors found`);

        console.info("Fetching indicators type...");
        const allIndicatorsTypes = await this.d2IndicatorType.get();

        const existingDataElements = this.generateDataElementsToImport(
            dataElementsFromExcel.filter(record => record.oldCode),
            allSectorsSeries,
            this.config,
            allIndicatorsTypes
        );
        console.info(`${existingDataElements.length} existing data elements`);

        const newDataElements = this.generateDataElementsToImport(
            dataElementsFromExcel.filter(record => !record.oldCode),
            allSectorsSeries,
            this.config,
            allIndicatorsTypes
        );
        console.info(`${newDataElements.length} new data elements`);

        return { newRecords: newDataElements, existingRecords: existingDataElements };
    }

    private generateDataElementsToImport(
        dataElementsFromExcel: DataElementExcel[],
        allSectorsSeries: Sector[],
        config: Config,
        indicatorsTypes: IndicatorType[]
    ): DataElement[] {
        const pairedDataElements = _(dataElementsFromExcel)
            .keyBy(record => record.code)
            .value();

        return _(dataElementsFromExcel)
            .map((excelRecord, index): DataElement => {
                const type = this.getDataElementType(excelRecord, index);

                const mainSector = this.getMainSector(allSectorsSeries, excelRecord, index);

                const series = this.getSeriesSector(
                    allSectorsSeries,
                    excelRecord.series,
                    excelRecord.sector
                );

                const crossSectorSeriesCodes = excelRecord.crossSectorSeries
                    ? DataElement.getCrossSectorsCodes(excelRecord.crossSectorSeries, false)
                    : [];

                const crossSectorCodes = excelRecord.crossSectors
                    ? DataElement.getCrossSectorsCodes(excelRecord.crossSectors, false)
                    : [];

                const crossSeries = _(crossSectorSeriesCodes)
                    .map((crossSectorSerieCode, index) => {
                        return this.getSeriesSector(
                            allSectorsSeries,
                            crossSectorSerieCode,
                            crossSectorCodes[index]
                        );
                    })
                    .value();

                const crossSectors = _(crossSectorCodes)
                    .map(crossSectorCode => {
                        const crossSector = allSectorsSeries.find(
                            sector => sector.name.toLowerCase() === crossSectorCode.toLowerCase()
                        );
                        if (!crossSector)
                            throw Error(
                                `Row ${index + 1}: Cannot find cross sector: ${crossSectorCode}`
                            );
                        return crossSector;
                    })
                    .value();

                const mainTypeSectorInfo = allSectorsSeries.find(
                    sector => sector.code.toLowerCase() === type.toLowerCase()
                );
                if (!mainTypeSectorInfo)
                    throw Error(`Cannot find mainType: ${type.toLocaleLowerCase()}`);

                const mainType: DataElement["mainType"] = {
                    name: type,
                    sector: mainTypeSectorInfo,
                };

                const indicatorTypeGroup = allSectorsSeries.find(
                    sector =>
                        sector.code.toLowerCase() === excelRecord.globalSub.toLocaleLowerCase()
                );
                if (!indicatorTypeGroup) {
                    throw Error(
                        `Error in row ${index + 1}: Invalid value in column Global/Sub = ${
                            excelRecord.globalSub
                        }`
                    );
                }

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
                    indicatorType: indicatorTypeGroup,
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

    private getSeriesSector(allSectors: Sector[], seriesName: string, sectorCode: Maybe<string>) {
        const name = `Series ${seriesName}`;
        const series = allSectors.find(sector => sector.name.toLowerCase() === name.toLowerCase());
        if (!series) {
            const serieId = getUid("series", name);
            if (!sectorCode) throw Error(`Invalid sector code for series ${seriesName}`);
            return {
                id: serieId,
                name: name,
                shortName: name,
                code: `SERIES_${sectorCode.toUpperCase()}_${seriesName}`,
            };
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
        const excelFile = xlsx.readFile(path);
        const excelSheetName = excelFile.SheetNames.find(sn => sn === "CreateUpdate") || "";
        const sheet = excelFile.Sheets[excelSheetName];
        if (!sheet) throw Error("Sheet not found");
        const seasonsExcel = xlsx.utils.sheet_to_json<SpreadSheetRecord>(sheet);
        return this.parseRecords(seasonsExcel);
    }

    private parseRecords(records: SpreadSheetRecord[]): DataElementExcel[] {
        return records.map(record => {
            return {
                sector: record.Sector,
                oldCode: record["Old code"],
                code: record.Code,
                id: record.Id,
                actualTargetIndicatorId: record["Actual/Target Indicator ID"],
                costBenefitIndicatorId: record["Cost/Benefit Indicator ID"],
                name: record.Name,
                description: record.Description,
                globalSub: record["Global/Sub"],
                peopleBenefit: record["People/Benefit"],
                benefitDisaggregation: record["Benefit disaggregation"],
                series: record.Series,
                pairedPeople: record["Paired People (only for benefit ind)"],
                external: record.External,
                countingMethod: record["Counting Method"],
                crossSectorSeries: record["Cross Sector Series"],
                crossSectors: record["Cross Sectors"],
            };
        });
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

type SpreadSheetRecord = {
    Sector: string;
    "Old code": string;
    Code: string;
    Id: string;
    "Actual/Target Indicator ID": string;
    "Cost/Benefit Indicator ID": string;
    Name: string;
    Description: string;
    "Global/Sub": string;
    "People/Benefit": string;
    "Benefit disaggregation": string;
    Series: string;
    "Paired People (only for benefit ind)": string;
    External: string;
    "Counting Method": string;
    "Cross Sector Series": string;
    "Cross Sectors": string;
};

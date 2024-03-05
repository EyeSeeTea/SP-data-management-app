import { DataElement } from "../entities/DataElement";
import { DataValue } from "../entities/DataValue";
import { OrgUnit } from "../entities/OrgUnit";
import { DataElementRepository } from "../repositories/DataElementRepository";
import { DataValueExportRepository } from "../repositories/DataValueExportRepository";
import { DataValueRepository } from "../repositories/DataValueRepository";
import { ExportDataElementRepository } from "../repositories/ExportDataElementRepository";
import { ImportDataElementRepository } from "../repositories/ImportDataElementRepository";
import { OrgUnitRepository } from "../repositories/OrgUnitRepository";

const DE_DELETE_GROUP_CODE = "DEG_TEMP_REMOVE_DATAELEMENTS";

export class ImportDataElementsUseCase {
    constructor(
        private importDataElementSheetRepository: ImportDataElementRepository,
        private dataElementRepository: DataElementRepository,
        private exportDataElementRepository: ExportDataElementRepository,
        private dataValueRepository: DataValueRepository,
        private dataValueExportRepository: DataValueExportRepository,
        private orgUnitRepository: OrgUnitRepository
    ) {}

    async execute(options: ImportDataElementsUseCaseOptions): Promise<void> {
        const { newRecords, existingRecords, removedRecords } =
            await this.importDataElementSheetRepository.import(options.excelPath);

        const dataElementsToRemove = await this.dataElementRepository.getByIds(removedRecords);
        const dataValuesBackup = await this.getDataValues(dataElementsToRemove);

        if (options.export) {
            console.info("Exporting metadata files...");
            await this.exportDataElementRepository.export(
                "metadata_deleted.json",
                dataElementsToRemove,
                { ignoreGroups: true }
            );
            await this.exportDataElementRepository.export("metadata_new.json", newRecords, {
                ignoreGroups: false,
            });
            await this.exportDataElementRepository.export(
                "metadata_existing.json",
                existingRecords,
                { ignoreGroups: false }
            );
            console.info("Metadata files exported");
        } else {
            console.info("Add --export to generate metadata");
        }

        if (options.post) {
            await this.removeDataValues(options, dataValuesBackup);
            console.info("Deleting existing data elements...\n");
            await this.dataElementRepository.remove(dataElementsToRemove, options);
            console.info("Existing data elements removed\n");

            console.info("Importing existing data elements...\n");
            await this.dataElementRepository.save(existingRecords, options);
            console.info("Existing data elements imported\n");

            console.info("-------------------------------------\n");

            console.info("Importing new data elements...\n");
            await this.dataElementRepository.save(newRecords, options);
            console.info("New data elements imported\n");
        } else {
            console.info("Add --post flag to save changes");
        }
    }

    private async removeDataValues(
        options: ImportDataElementsUseCaseOptions,
        dataValuesBackup: DataValue[]
    ) {
        if (dataValuesBackup.length === 0) return false;
        if (options.deleteDataValues) {
            console.info("Removing dataValues...");
            const dataValuesToRemove = dataValuesBackup.map(dataValue => {
                return { ...dataValue, deleted: true };
            });
            await this.dataValueRepository.remove(dataValuesToRemove);
        } else {
            throw Error(
                "There are dataValues associated with the dataElements to remove. You should re-execute the command with the option --deleteDataValues"
            );
        }
    }

    private async getDataValues(dataElementsToRemove: DataElement[]): Promise<DataValue[]> {
        if (dataElementsToRemove.length === 0) return [];
        const orgUnit = await this.getOrgUnitId();
        console.info("Looking for data values in dataElements to be removed...");
        const dataValues = await this.dataValueRepository.get({
            includeDeleted: false,
            orgUnitIds: [orgUnit.id],
            children: true,
            endDate: "2050",
            startDate: "1950",
            tempDataElementGroup: {
                code: DE_DELETE_GROUP_CODE,
                dataElements: dataElementsToRemove.map(dataElement => ({ id: dataElement.id })),
            },
        });

        await this.exportDataValues(dataValues);

        return dataValues;
    }

    private async exportDataValues(dataValues: DataValue[]) {
        console.info(`${dataValues.length} dataValues found. Generating backup...`);
        const backupFileName = "dataValues_backup";
        await this.dataValueExportRepository.export(backupFileName, dataValues);
        console.info(`Backup generated: ${backupFileName}.json`);
    }

    private getOrgUnitId(): Promise<OrgUnit> {
        return this.orgUnitRepository.getByIdentifiable("IHQ");
    }
}

export type ImportDataElementsUseCaseOptions = {
    excelPath: string;
    post: boolean;
    export: boolean;
    deleteDataValues: boolean;
};

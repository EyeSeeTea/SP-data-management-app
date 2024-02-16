import { DataElementGroup } from "../../data/DataElementGroup";
import { Maybe } from "../../types/utils";
import { getUid } from "../../utils/dhis2";
import { DataElement } from "../entities/DataElement";
import { DataValue } from "../entities/DataValue";
import { OrgUnit } from "../entities/OrgUnit";
import { AuditDataElementExportRepository } from "../repositories/AuditDataElementExportRepository";
import { DataElementGroupRepository } from "../repositories/DataElementGroupRepository";
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
        private dataElementGroupRepository: DataElementGroupRepository,
        private dataValueRepository: DataValueRepository,
        private dataValueExportRepository: DataValueExportRepository,
        private auditDataElementExportRepository: AuditDataElementExportRepository,
        private orgUnitRepository: OrgUnitRepository
    ) {}

    async execute(options: ImportDataElementsUseCaseOptions): Promise<void> {
        const { newRecords, existingRecords, removedRecords } =
            await this.importDataElementSheetRepository.import(options.excelPath);

        const dataElementsToRemove = await this.dataElementRepository.getByIds(removedRecords);
        const dataElementGroup = await this.getOrCreateTempDataElementGroup(dataElementsToRemove);
        if (dataElementsToRemove.length > 0 && !dataElementGroup) {
            throw Error(
                `There are dataElements to remove but cannot find temp. dataElementGroup: ${DE_DELETE_GROUP_CODE}`
            );
        }
        const dataValuesBackup = await this.getDataValues(dataElementGroup, dataElementsToRemove);

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

        if (dataElementGroup) {
            await this.dataElementGroupRepository.remove([dataElementGroup]);
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

    private async getOrCreateTempDataElementGroup(
        dataElements: DataElement[]
    ): Promise<Maybe<DataElementGroup>> {
        if (dataElements.length === 0) return undefined;
        const dataElementGroup = await this.dataElementGroupRepository.getByCode(
            DE_DELETE_GROUP_CODE
        );
        if (dataElementGroup) return dataElementGroup;
        const tempDataElementGroup = {
            id: getUid("dataElementGroups", DE_DELETE_GROUP_CODE),
            code: DE_DELETE_GROUP_CODE,
            name: DE_DELETE_GROUP_CODE,
            shortName: DE_DELETE_GROUP_CODE,
            dataElements: dataElements.map(dataElement => ({ id: dataElement.id })),
        };
        await this.dataElementGroupRepository.save([tempDataElementGroup]);
        return tempDataElementGroup;
    }

    private async getDataValues(
        dataElementGroup: Maybe<DataElementGroup>,
        dataElementsToRemove: DataElement[]
    ): Promise<DataValue[]> {
        if (dataElementsToRemove.length === 0 || !dataElementGroup) return [];
        const orgUnit = await this.getOrgUnitId();
        console.info("Looking for data values in dataElements to be removed...");
        const dataValues = await this.dataValueRepository.get({
            includeDeleted: false,
            orgUnitIds: [orgUnit.id],
            children: true,
            endDate: "2050",
            startDate: "1950",
            dataElementGroupIds: [dataElementGroup.id],
        });

        await this.exportDataValues(dataValues);
        await this.exportSqlAuditValues(dataElementsToRemove);

        return dataValues;
    }

    private async exportSqlAuditValues(dataElementsToRemove: DataElement[]) {
        console.info("Generating sql file for deleting audit entries...");
        await this.auditDataElementExportRepository.export(dataElementsToRemove);
        console.info("Sql file generated: audit_data_element.sql");
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

import { DataElementRepository } from "../repositories/DataElementRepository";
import { ExportDataElementRepository } from "../repositories/ExportDataElementRepository";
import { ImportDataElementRepository } from "../repositories/ImportDataElementRepository";

export class ImportDataElementsUseCase {
    constructor(
        private importDataElementSheetRepository: ImportDataElementRepository,
        private dataElementRepository: DataElementRepository,
        private exportDataElementRepository: ExportDataElementRepository
    ) {}

    async execute(options: ImportDataElementsUseCaseOptions): Promise<void> {
        const { newRecords, existingRecords, removedRecords } =
            await this.importDataElementSheetRepository.import(options.excelPath);

        const dataElementsToRemove = await this.dataElementRepository.getByIds(removedRecords);

        if (options.post) {
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
    }
}

export type ImportDataElementsUseCaseOptions = {
    excelPath: string;
    post: boolean;
    export: boolean;
};

import { DataElementRepository } from "../repositories/DataElementRepository";
import { ImportDataElementSpreadSheetRepository } from "../../data/repositories/ImportDataElementSpreadSheetRepository";
import { ExportDataElementRepository } from "../repositories/ExportDataElementRepository";

export class ImportDataElementsUseCase {
    constructor(
        private importDataElementSpreadSheetRepository: ImportDataElementSpreadSheetRepository,
        private dataElementRepository: DataElementRepository,
        private exportDataElementRepository: ExportDataElementRepository
    ) {}

    async execute(options: ImportDataElementsUseCaseOptions): Promise<void> {
        const { newRecords, existingRecords } =
            await this.importDataElementSpreadSheetRepository.import(options.excelPath);

        if (options.post) {
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
            await this.exportDataElementRepository.export("metadata_new.json", existingRecords);
            await this.exportDataElementRepository.export("metadata_existing.json", newRecords);
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

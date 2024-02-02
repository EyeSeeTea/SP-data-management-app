import { DataElement } from "../entities/DataElement";

export interface ImportDataElementRepository {
    import(path: string): Promise<ImportDataElement>;
}

export type ImportDataElement = { newRecords: DataElement[]; existingRecords: DataElement[] };

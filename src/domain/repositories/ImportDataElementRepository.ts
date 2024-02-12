import { DataElement } from "../entities/DataElement";
import { Id } from "../entities/Ref";

export interface ImportDataElementRepository {
    import(path: string): Promise<ImportDataElement>;
}

export type ImportDataElement = {
    newRecords: DataElement[];
    existingRecords: DataElement[];
    removedRecords: Id[];
};

import { DataElement } from "../entities/DataElement";

export interface ExportDataElementRepository {
    export(path: string, dataElements: DataElement[]): Promise<void>;
}

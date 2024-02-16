import { DataElement } from "../entities/DataElement";

export interface AuditDataElementExportRepository {
    export(dataElements: DataElement[]): Promise<void>;
}

import { DataElement } from "../entities/DataElement";

export interface ExportDataElementRepository {
    export(path: string, dataElements: DataElement[], options: ExportOptions): Promise<void>;
}

export type ExportOptions = { ignoreGroups: boolean };

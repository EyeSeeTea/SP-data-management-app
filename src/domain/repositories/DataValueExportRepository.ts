import { DataValue } from "../entities/DataValue";

export interface DataValueExportRepository {
    export(path: string, dataValues: DataValue[]): Promise<void>;
}

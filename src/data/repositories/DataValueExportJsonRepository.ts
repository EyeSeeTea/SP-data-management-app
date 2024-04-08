import { DataValue } from "../../domain/entities/DataValue";
import { DataValueExportRepository } from "../../domain/repositories/DataValueExportRepository";
import { writeJsonToDisk } from "../../scripts/utils/logger";

export class DataValueExportJsonRepository implements DataValueExportRepository {
    async export(path: string, dataValues: DataValue[]): Promise<void> {
        writeJsonToDisk(path, { dataValues: dataValues });
    }
}

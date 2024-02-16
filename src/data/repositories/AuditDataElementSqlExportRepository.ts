import { DataElement } from "../../domain/entities/DataElement";
import { AuditDataElementExportRepository } from "../../domain/repositories/AuditDataElementExportRepository";
import { writeToDisk } from "../../scripts/utils/logger";

export class AuditDataElementSqlExportRepository implements AuditDataElementExportRepository {
    async export(dataElements: DataElement[]): Promise<void> {
        const sqlContent = dataElements.map(dataElement => {
            return `delete from datavalueaudit where dataelementid IN (select dataelementid from dataelement where uid = '${dataElement.id}');`;
        });
        writeToDisk("audit_data_element.sql", sqlContent.join("\n"));
    }
}

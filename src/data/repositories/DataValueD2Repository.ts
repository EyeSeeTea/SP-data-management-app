import { D2Api } from "../../types/d2-api";
import { DataValue } from "../../domain/entities/DataValue";
import {
    DataValueRepository,
    GetDataValueOptions,
} from "../../domain/repositories/DataValueRepository";
import { D2DataElementGroup } from "./D2DataElementGroup";
import { Ref } from "../../domain/entities/Ref";
import { DataElementGroup } from "../DataElementGroup";
import { getUid } from "../../utils/dhis2";
import { Maybe } from "../../types/utils";
import { writeToDisk } from "../../scripts/utils/logger";

const DE_DELETE_GROUP_CODE = "DEG_TEMP_REMOVE_DATAELEMENTS";

export class DataValueD2Repository implements DataValueRepository {
    d2DataElementGroup: D2DataElementGroup;
    constructor(private api: D2Api) {
        this.d2DataElementGroup = new D2DataElementGroup(api);
    }

    async get(options: GetDataValueOptions): Promise<DataValue[]> {
        const dataElementGroup = await this.createTempDataElementGroup(options);
        const res$ = this.api.dataValues.getSet({
            dataSet: [],
            orgUnit: options.orgUnitIds,
            dataElementGroup: dataElementGroup ? [dataElementGroup.id] : undefined,
            children: options.children,
            includeDeleted: false,
            startDate: options.startDate,
            endDate: options.endDate,
        });
        const res = await res$.getData();
        if (dataElementGroup) {
            await this.d2DataElementGroup.remove([dataElementGroup]);
            await this.exportSqlAuditDataElements(dataElementGroup.dataElements);
        }
        return res.dataValues;
    }

    async remove(dataValues: DataValue[]): Promise<void> {
        const res = await this.api.dataValues
            .postSet({ force: true, importStrategy: "DELETE" }, { dataValues })
            .getData();

        console.info("Remove Data values", JSON.stringify(res.importCount, null, 4));

        console.info("Permanently remove soft deleted data values...");
        await this.api.maintenance
            .runTasks([this.api.maintenance.tasks.softDeletedDataValueRemoval])
            .getData();
        console.info("Soft deleted data values finished.");
    }

    private async createTempDataElementGroup(
        options: GetDataValueOptions
    ): Promise<Maybe<DataElementGroup>> {
        if (!options.dataElementsIds) return undefined;
        const tempDataElementGroup: DataElementGroup = {
            id: getUid("dataElementGroups", DE_DELETE_GROUP_CODE),
            code: DE_DELETE_GROUP_CODE,
            name: DE_DELETE_GROUP_CODE,
            shortName: DE_DELETE_GROUP_CODE,
            dataElements: options.dataElementsIds.map(dataElementId => ({ id: dataElementId })),
        };
        const ids = [tempDataElementGroup.id];
        await this.d2DataElementGroup.save(ids, [tempDataElementGroup], [], { post: true });
        return tempDataElementGroup;
    }

    private async exportSqlAuditDataElements(dataElements: Ref[]): Promise<void> {
        const dataElementsIds = dataElements.map(dataElement => `'${dataElement.id}'`).join(",");
        const sqlContent = `delete from datavalueaudit where dataelementid IN (select dataelementid from dataelement where uid IN (${dataElementsIds}));`;
        writeToDisk("audit_data_element.sql", sqlContent);
    }
}

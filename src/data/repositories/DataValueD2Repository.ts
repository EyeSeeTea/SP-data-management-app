import { D2Api } from "../../types/d2-api";
import { DataValue } from "../../domain/entities/DataValue";
import {
    DataValueRepository,
    GetDataValueOptions,
} from "../../domain/repositories/DataValueRepository";

export class DataValueD2Repository implements DataValueRepository {
    constructor(private api: D2Api) {}

    async get(options: GetDataValueOptions): Promise<DataValue[]> {
        const res$ = this.api.dataValues.getSet({
            dataSet: [],
            orgUnit: options.orgUnitIds,
            dataElementGroup: options.dataElementGroupIds,
            children: options.children,
            includeDeleted: false,
            startDate: options.startDate,
            endDate: options.endDate,
        });
        const res = await res$.getData();
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
}

import { D2Api } from "../../types/d2-api";
import { DataElementGroupRepository } from "../../domain/repositories/DataElementGroupRepository";
import { DataElementGroup } from "../DataElementGroup";
import { Code } from "../../domain/entities/Ref";
import { D2DataElementGroup } from "./D2DataElementGroup";

export class DataElementD2GroupRepository implements DataElementGroupRepository {
    private d2DataElementGroup: D2DataElementGroup;

    constructor(private api: D2Api) {
        this.d2DataElementGroup = new D2DataElementGroup(this.api);
    }

    async getByCode(code: Code): Promise<DataElementGroup> {
        const response = await this.d2DataElementGroup.getByIdentifiables([code]);
        return response[0];
    }

    async save(dataElementGroups: DataElementGroup[]): Promise<void> {
        const ids = dataElementGroups.map(dataElementGroup => dataElementGroup.id);
        await this.d2DataElementGroup.save(ids, dataElementGroups, { post: true });
    }

    async remove(dataElementGroups: DataElementGroup[]): Promise<void> {
        await this.api.metadata
            .post(
                {
                    dataElementGroups: dataElementGroups.map(dataElementGroup => {
                        return { id: dataElementGroup.id };
                    }),
                },
                {
                    importStrategy: "DELETE",
                }
            )
            .getData();
    }
}

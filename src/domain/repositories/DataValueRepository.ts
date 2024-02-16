import { DataValue } from "../entities/DataValue";
import { Id } from "../entities/Ref";

export interface DataValueRepository {
    get(options: GetDataValueOptions): Promise<DataValue[]>;
    remove(dataValues: DataValue[]): Promise<void>;
}

export interface GetDataValueOptions {
    orgUnitIds: Id[];
    dataElementGroupIds?: Id[];
    children: boolean;
    includeDeleted: boolean;
    startDate: string;
    endDate: string;
}

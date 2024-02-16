import { DataElementGroup } from "../../data/DataElementGroup";
import { Maybe } from "../../types/utils";
import { Code } from "../entities/Ref";

export interface DataElementGroupRepository {
    getByCode(code: Code): Promise<Maybe<DataElementGroup>>;
    save(dataElementGroups: DataElementGroup[]): Promise<void>;
    remove(dataElementGroups: DataElementGroup[]): Promise<void>;
}

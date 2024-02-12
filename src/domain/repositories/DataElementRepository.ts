import { SaveOptions } from "../../data/SaveOptions";
import { DataElement } from "../entities/DataElement";
import { Id } from "../entities/Ref";

export interface DataElementRepository {
    getByIds(ids: Id[]): Promise<DataElement[]>;
    save(dataElements: DataElement[], options: SaveOptions): Promise<void>;
    remove(dataElements: DataElement[], options: SaveOptions): Promise<void>;
}

import { SaveOptions } from "../../data/SaveOptions";
import { DataElement } from "../entities/DataElement";

export interface DataElementRepository {
    save(dataElements: DataElement[], options: SaveOptions): Promise<void>;
}

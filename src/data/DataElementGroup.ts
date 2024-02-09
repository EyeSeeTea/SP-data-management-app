import { Ref } from "../domain/entities/Ref";

export interface DataElementGroup extends Ref {
    dataElements: Ref[];
}

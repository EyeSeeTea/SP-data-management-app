import { Code, NamedRef, Ref } from "../domain/entities/Ref";

export interface DataElementGroup extends NamedRef {
    code: Code;
    shortName: string;
    dataElements: Ref[];
    isSerie: boolean;
}

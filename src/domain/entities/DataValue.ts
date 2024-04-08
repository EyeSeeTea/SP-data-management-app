import { Period } from "../../models/Period";
import { Id } from "./Ref";

export interface DataValue {
    dataElement: Id;
    period: Period;
    orgUnit: Id;
    categoryOptionCombo: Id;
    attributeOptionCombo: Id;
    value: string;
    storedBy: string;
    created: string;
    lastUpdated: string;
    followup: boolean;
    deleted?: boolean;
}

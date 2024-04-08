import { Identifiable } from "../../data/Ref";
import { OrgUnit } from "../entities/OrgUnit";

export interface OrgUnitRepository {
    getByIdentifiable(identifiable: Identifiable): Promise<OrgUnit>;
}

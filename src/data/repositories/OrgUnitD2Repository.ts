import { D2Api } from "../../types/d2-api";
import { OrgUnit } from "../../domain/entities/OrgUnit";
import { OrgUnitRepository } from "../../domain/repositories/OrgUnitRepository";
import { Identifiable } from "../Ref";

export class OrgUnitD2Repository implements OrgUnitRepository {
    constructor(private api: D2Api) {}

    async getByIdentifiable(identifiable: Identifiable): Promise<OrgUnit> {
        const response = await this.api.models.organisationUnits
            .get({
                fields: { id: true },
                filter: { identifiable: { eq: identifiable } },
            })
            .getData();
        const d2OrgUnit = response.objects[0];
        if (!d2OrgUnit) throw Error(`Cannot find OrgUnit: ${identifiable}`);
        return d2OrgUnit;
    }
}

import { D2Api } from "../../types/d2-api";
import { DataElement } from "../../domain/entities/DataElement";
import { DataElementRepository } from "../../domain/repositories/DataElementRepository";
import { Config } from "../../models/Config";
import { D2DataElement } from "./D2DataElement";
import { D2DataElementGroup } from "./D2DataElementGroup";
import { D2Indicator } from "./D2Indicator";
import { D2IndicatorType } from "./D2IndicatorType";
import { SaveOptions } from "../SaveOptions";

export class DataElementD2Repository implements DataElementRepository {
    d2DataElement: D2DataElement;
    d2DataElementGroup: D2DataElementGroup;
    d2Indicator: D2Indicator;
    d2IndicatorType: D2IndicatorType;

    constructor(private api: D2Api, private config: Config) {
        this.d2DataElement = new D2DataElement(this.api, this.config);
        this.d2DataElementGroup = new D2DataElementGroup(this.api);
        this.d2Indicator = new D2Indicator(this.api);
        this.d2IndicatorType = new D2IndicatorType(this.api);
    }

    async save(dataElements: DataElement[], options: SaveOptions): Promise<void> {
        const {
            ids,
            dataElementGroups,
            dataElementGroupsIds,
            indicators,
            indicatorsIds,
            indicatorsGroups,
            indicatorsGroupsIds,
        } = this.d2DataElement.extractMetadata(dataElements);

        await this.d2DataElement.save(ids, dataElements, options);
        await this.d2DataElementGroup.save(dataElementGroupsIds, dataElementGroups, options);
        await this.d2Indicator.save(indicatorsIds, indicators, options);
        await this.d2IndicatorType.save(indicatorsGroupsIds, indicatorsGroups, options);
    }
}

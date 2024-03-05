import {
    ExportDataElementRepository,
    ExportOptions,
} from "../../domain/repositories/ExportDataElementRepository";
import { D2Api } from "../../types/d2-api";
import { DataElement } from "../../domain/entities/DataElement";
import { Config } from "../../models/Config";
import { D2DataElement } from "./D2DataElement";
import { writeJsonToDisk } from "../../scripts/utils/logger";
import { D2DataElementGroup } from "./D2DataElementGroup";
import { D2Indicator } from "./D2Indicator";
import { D2IndicatorType } from "./D2IndicatorType";

export class ExportDataElementJsonRepository implements ExportDataElementRepository {
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

    async export(path: string, dataElements: DataElement[], options: ExportOptions): Promise<void> {
        const {
            ids,
            dataElementGroups,
            dataElementGroupsIds,
            indicators,
            indicatorsIds,
            indicatorsGroups,
            indicatorsGroupsIds,
        } = this.d2DataElement.extractMetadata(dataElements, options);

        const d2DataElements = await this.d2DataElement.save(ids, dataElements, { post: false });
        const d2DataElementGroups = await this.d2DataElementGroup.save(
            dataElementGroupsIds,
            dataElementGroups,
            { post: false }
        );
        const d2Indicators = await this.d2Indicator.save(indicatorsIds, indicators, {
            post: false,
        });
        const d2IndicatorsGroups = await this.d2IndicatorType.save(
            indicatorsGroupsIds,
            indicatorsGroups,
            { post: false }
        );
        writeJsonToDisk(path, {
            dataElements: d2DataElements,
            dataElementGroups: d2DataElementGroups,
            indicators: d2Indicators,
            indicatorGroups: d2IndicatorsGroups,
        });
    }
}

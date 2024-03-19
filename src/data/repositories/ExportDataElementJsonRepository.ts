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
import { getExistingAndNewDataElements } from "../common";

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
            existingDataElements,
            existingDataElementsKeys,
            newDataElements,
            newDataElementsKeys,
        } = getExistingAndNewDataElements(dataElements);

        const {
            ids,
            dataElementGroups,
            dataElementGroupsIds,
            newIndicators,
            existingIndicators,
            indicatorsGroups,
            indicatorsGroupsIds,
        } = this.d2DataElement.extractMetadata(dataElements, options);

        if (existingDataElements.length > 0) {
            const d2DataElementsExisting = await this.d2DataElement.save(
                ids.filter(id => Boolean(existingDataElementsKeys[id])),
                existingDataElements,
                {
                    post: false,
                }
            );
            writeJsonToDisk("dataElements_existing.json", {
                dataElements: d2DataElementsExisting,
            });
        }

        if (newDataElements.length > 0) {
            const d2DataElementsNew = await this.d2DataElement.save(
                ids.filter(id => Boolean(newDataElementsKeys[id])),
                newDataElements,
                {
                    post: false,
                }
            );
            writeJsonToDisk("dataElements_new.json", {
                dataElements: d2DataElementsNew,
            });
        }

        const d2DataElementGroups = await this.d2DataElementGroup.save(
            dataElementGroupsIds,
            dataElementGroups,
            { post: false }
        );

        if (existingIndicators.indicators.length > 0) {
            const d2Indicators = await this.d2Indicator.save(
                existingIndicators.indicatorsIds,
                existingIndicators.indicators,
                {
                    post: false,
                }
            );
            writeJsonToDisk("indicators_existing.json", {
                indicators: d2Indicators,
            });
        }

        if (newIndicators.indicators.length > 0) {
            const d2IndicatorsNew = await this.d2Indicator.save(
                newIndicators.indicatorsIds,
                newIndicators.indicators,
                {
                    post: false,
                }
            );
            writeJsonToDisk("indicators_new.json", {
                indicators: d2IndicatorsNew,
            });
        }

        const d2IndicatorsGroups = await this.d2IndicatorType.save(
            indicatorsGroupsIds,
            indicatorsGroups,
            { post: false }
        );

        writeJsonToDisk(path, {
            dataElementGroups: d2DataElementGroups,
            indicatorGroups: d2IndicatorsGroups,
        });
    }
}

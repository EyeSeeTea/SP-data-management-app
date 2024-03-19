import _ from "lodash";
import { DataElement } from "../domain/entities/DataElement";

export function getExistingAndNewDataElements(dataElements: DataElement[]) {
    const existingDataElements = _(dataElements)
        .filter(dataElement => dataElement.existing)
        .value();

    const existingDataElementsKeys = _(existingDataElements)
        .keyBy(dataElement => dataElement.id)
        .value();

    const newDataElements = _(dataElements)
        .filter(dataElement => !dataElement.existing)
        .value();

    const newDataElementsKeys = _(newDataElements)
        .keyBy(dataElement => dataElement.id)
        .value();

    return { existingDataElements, existingDataElementsKeys, newDataElements, newDataElementsKeys };
}

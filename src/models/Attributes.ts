import { Ref } from "../types/d2-api";

export type AttributeValue = { attribute: Ref; value: string };

export function addAttributeValue(
    attributeValues: AttributeValue[],
    attribute: Ref,
    value: string
) {
    return attributeValues
        .filter(av => av.attribute.id !== attribute.id)
        .concat([{ value, attribute: { id: attribute.id } }]);
}

export function addAttributeValueToObj<Obj extends { attributeValues: AttributeValue[] }>(
    obj: Obj,
    options: {
        values: AttributeValue[];
        attribute: Ref;
        value: string;
    }
) {
    const newValues = addAttributeValue(options.values, options.attribute, options.value);
    return { ...obj, attributeValues: newValues };
}

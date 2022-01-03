import _ from "lodash";
import { Ref } from "../types/d2-api";
import { Maybe } from "../types/utils";

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

type ObjWithAttributes = { attributeValues: AttributeValue[] };

export function addAttributeValueToObj<Obj extends ObjWithAttributes>(
    obj: Obj,
    options: {
        attribute: Ref;
        value: string;
    }
) {
    const newValues = addAttributeValue(obj.attributeValues, options.attribute, options.value);
    return { ...obj, attributeValues: newValues };
}

export function getAttributeValue(obj: ObjWithAttributes, attribute: Ref): Maybe<string> {
    return _(obj.attributeValues)
        .filter(av => av.attribute.id === attribute.id)
        .map(av => av.value)
        .first();
}

import { Struct } from "./generic/Struct";
import { NamedRef } from "./Ref";

type IndicatorTypeAttrs = NamedRef & { category: IndicatorCategory; symbol: string };

export type IndicatorCategory = "actual" | "benefit";

export class IndicatorType extends Struct<IndicatorTypeAttrs>() {
    static getCategoryFromName(name: string): IndicatorCategory {
        switch (name) {
            case "percentage":
                return "actual";
            case "ratio":
                return "benefit";
            default:
                throw Error(`Cannot found indicator type category for ${name}`);
        }
    }

    static getSymbolFromName(name: string): string {
        switch (name) {
            case "percentage":
                return "%";
            case "ratio":
                return "ratio";
            default:
                throw Error(`Cannot found indicator type symbol for ${name}`);
        }
    }
}

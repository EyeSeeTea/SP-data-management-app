import i18n from "../locales";

export type ValidationError = string[];

export function validatePresence(value: any, field: string): ValidationError {
    const isBlank =
        !value ||
        (value.length !== undefined && value.length === 0) ||
        (value.strip !== undefined && !value.strip());

    return isBlank ? [i18n.t("{{field}} cannot be blank", { field })] : [];
}

export function validateNonEmpty(value: any[], field: string): ValidationError {
    return value.length === 0 ? [i18n.t("Select at least one item for {{field}}", { field })] : [];
}

export function validateNumber(
    value: number,
    field: string,
    { min, max }: { min?: number; max?: number } = {}
): ValidationError {
    if (min && value < min) {
        return [
            i18n.t("{{field}} must be greater than or equal to {{value}}", { field, value: min }),
        ];
    } else if (max && value > max) {
        return [i18n.t("{{field}} must be less than or equal to {{value}}", { field, value: max })];
    } else {
        return [];
    }
}

export function validateRegexp(
    value: string,
    field: string,
    regexp: RegExp,
    customMsg: string
): ValidationError {
    return regexp.test(value)
        ? []
        : [
              customMsg ||
                  i18n.t("{{field}} does not match pattern {{pattern}}", {
                      field,
                      pattern: regexp.source,
                  }),
          ];
}

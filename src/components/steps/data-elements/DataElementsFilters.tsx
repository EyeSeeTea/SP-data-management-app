import React from "react";
import { indicatorTypes } from "../../../models/dataElementsSet";
import Dropdown from "../../dropdown/Dropdown";
import i18n from "../../../locales";
import { Checkbox, FormControlLabel } from "@material-ui/core";

interface DataElementsFiltersProps {
    filter: Filter;
    filterOptions: FilterOptions;
    onChange(newFilters: Filter): void;
}

export interface Filter {
    series?: string;
    indicatorType?: string;
    onlySelected?: boolean;
}

export interface FilterOptions {
    series: string[];
}

const DataElementsFilters: React.FC<DataElementsFiltersProps> = props => {
    const { filter, filterOptions, onChange } = props;

    return (
        <div>
            <Dropdown
                items={filterOptions.series.map(name => ({ value: name, text: name }))}
                value={filter.series}
                onChange={value => onChange({ ...filter, series: value })}
                label={i18n.t("Series")}
            />

            <Dropdown
                items={indicatorTypes.map(name => ({ value: name, text: name }))}
                value={filter.indicatorType}
                onChange={value => onChange({ ...filter, indicatorType: value })}
                label={i18n.t("Indicator Type")}
            />

            <FormControlLabel
                label={i18n.t("Only selected")}
                control={
                    <Checkbox
                        checked={!!filter.onlySelected}
                        onChange={ev => onChange({ ...filter, onlySelected: ev.target.checked })}
                    />
                }
            />
        </div>
    );
};

export default DataElementsFilters;

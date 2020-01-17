import React from "react";
import { indicatorTypes, IndicatorType } from "../../../models/dataElementsSet";
import Dropdown from "../../dropdown/Dropdown";
import i18n from "../../../locales";
import { Checkbox, FormControlLabel } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";
import MultipleDropdown from "../../dropdown/MultipleDropdown";

interface DataElementsFiltersProps {
    filter: Filter;
    filterOptions: FilterOptions;
    onChange(newFilters: Filter): void;
}

export interface Filter {
    series?: string;
    indicatorType?: IndicatorType;
    onlySelected?: boolean;
    externals?: string[];
}

export interface FilterOptions {
    series: string[];
    externals: string[];
}

const DataElementsFilters: React.FC<DataElementsFiltersProps> = props => {
    const { filter, filterOptions, onChange } = props;
    const classes = useStyles();

    const externalsOptions = [{ value: "", text: i18n.t("Internals") }].concat(
        filterOptions.externals.map(name => ({ value: name, text: name }))
    );

    return (
        <div>
            <Dropdown
                items={indicatorTypes.map(name => ({ value: name, text: name }))}
                value={filter.indicatorType}
                onChange={value => onChange({ ...filter, indicatorType: value as IndicatorType })}
                label={i18n.t("Indicator Type")}
            />

            <Dropdown
                items={filterOptions.series.map(name => ({ value: name, text: name }))}
                value={filter.series}
                onChange={value => onChange({ ...filter, series: value })}
                label={i18n.t("Series")}
            />

            <MultipleDropdown
                items={externalsOptions}
                values={filter.externals || []}
                onChange={values => onChange({ ...filter, externals: values })}
                label={i18n.t("Externals")}
            />

            <FormControlLabel
                label={i18n.t("Only selected")}
                className={classes.checkbox}
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

const useStyles = makeStyles({
    checkbox: { marginLeft: 5 },
});

export default DataElementsFilters;

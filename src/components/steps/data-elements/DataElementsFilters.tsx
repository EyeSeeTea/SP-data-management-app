import React from "react";
import { indicatorTypes } from "../../../models/dataElementsSet";
import Dropdown from "../../dropdown/Dropdown";
import i18n from "../../../locales";
import { Checkbox, FormControlLabel } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";

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
    const classes = useStyles();

    return (
        <div>
            <Dropdown
                items={indicatorTypes.map(name => ({ value: name, text: name }))}
                value={filter.indicatorType}
                onChange={value => onChange({ ...filter, indicatorType: value })}
                label={i18n.t("Indicator Type")}
            />

            <Dropdown
                items={filterOptions.series.map(name => ({ value: name, text: name }))}
                value={filter.series}
                onChange={value => onChange({ ...filter, series: value })}
                label={i18n.t("Series")}
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

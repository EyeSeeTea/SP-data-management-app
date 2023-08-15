import React from "react";
import { Checkbox, CheckboxProps, FormControlLabel } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";
import MultipleDropdown from "../../components/dropdown/MultipleDropdown";
import i18n from "../../locales";

export interface ProjectsListFiltersProps {
    filter: Filter;
    filterOptions: FilterOptions;
    onChange(newFilters: Filter): void;
}

export interface Filter {
    search: string;
    countries: string[];
    sectors: string[];
    onlyActive: boolean;
}

export interface Option {
    id: string;
    displayName: string;
}

export interface FilterOptions {
    countriesAll: Option[];
    countriesOnlyActive: Option[];
    sectors: Option[];
}

const emptyValues: string[] = [];

type OnChange = NonNullable<CheckboxProps["onChange"]>;

const ProjectsListFilters: React.FC<ProjectsListFiltersProps> = props => {
    const { filter, filterOptions, onChange } = props;
    const classes = useStyles();
    const countryItems = useMemoOptions(
        filter.onlyActive ? filterOptions.countriesOnlyActive : filterOptions.countriesAll
    );
    const sectorItems = useMemoOptions(filterOptions.sectors);

    const notifyCountriesChange = React.useCallback(
        countries => onChange({ ...filter, countries }),
        [onChange, filter]
    );

    const notifySectorsChange = React.useCallback(
        sectors => onChange({ ...filter, sectors }),
        [onChange, filter]
    );

    const notifyOnlyActiveChange = React.useCallback<OnChange>(
        (_ev, checked) => {
            onChange({ ...filter, onlyActive: checked });
        },
        [onChange, filter]
    );

    return (
        <div className={classes.wrapper}>
            <MultipleDropdown
                items={countryItems}
                values={filter.countries || emptyValues}
                onChange={notifyCountriesChange}
                label={i18n.t("Countries")}
            />
            <MultipleDropdown
                items={sectorItems}
                values={filter.sectors || emptyValues}
                onChange={notifySectorsChange}
                label={i18n.t("Sectors")}
            />
            <FormControlLabel
                label={i18n.t("Active")}
                className={classes.checkbox}
                control={
                    <Checkbox checked={!!filter.onlyActive} onChange={notifyOnlyActiveChange} />
                }
            />
        </div>
    );
};

const useStyles = makeStyles({
    checkbox: { marginLeft: "5px !important" },
    wrapper: { marginLeft: 10, marginTop: 10 },
});

function useMemoOptions(options: Option[]) {
    return React.useMemo(() => {
        return options.map(option => ({
            value: option.id,
            text: option.displayName,
        }));
    }, [options]);
}

export default React.memo(ProjectsListFilters);

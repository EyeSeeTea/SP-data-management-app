import React from "react";
import { Checkbox, FormControlLabel } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";
import MultipleDropdown from "../../components/dropdown/MultipleDropdown";
import i18n from "../../locales";

interface ProjectsListFiltersProps {
    filter: Filter;
    filterOptions: FilterOptions;
    onChange(newFilters: Filter): void;
}

export interface Filter {
    countries?: string[];
    sectors?: string[];
    onlyActive?: boolean;
}

type Option = { id: string; displayName: string };

export interface FilterOptions {
    countries: Option[];
    sectors: Option[];
}

const ProjectsListFilters: React.FC<ProjectsListFiltersProps> = props => {
    const { filter, filterOptions, onChange } = props;
    const classes = useStyles();

    const countryItems = React.useMemo(() => {
        return filterOptions.countries.map(option => ({
            value: option.id,
            text: option.displayName,
        }));
    }, [filterOptions.countries]);

    const sectorsItems = React.useMemo(() => {
        return filterOptions.sectors.map(option => ({
            value: option.id,
            text: option.displayName,
        }));
    }, [filterOptions.countries]);

    return (
        <div>
            <MultipleDropdown
                items={countryItems}
                values={filter.countries || []}
                onChange={countries => onChange({ ...filter, countries })}
                label={i18n.t("Countries")}
            />

            <FormControlLabel
                label={i18n.t("Only selected")}
                className={classes.checkbox}
                control={
                    <Checkbox
                        checked={!!filter.onlyActive}
                        onChange={ev => onChange({ ...filter, onlyActive: ev.target.checked })}
                    />
                }
            />
        </div>
    );
};

const useStyles = makeStyles({
    checkbox: { marginLeft: 5 },
});

export default ProjectsListFilters;

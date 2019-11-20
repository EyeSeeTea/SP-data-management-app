import React from "react";
import {
    createMuiTheme,
    FormControl,
    InputLabel,
    MenuItem,
    MuiThemeProvider,
    Select,
} from "@material-ui/core";
import cyan from "@material-ui/core/colors/cyan";
import i18n from "../../locales";

type Value = string;

interface DropdownProps {
    items: Array<{ value: Value; text: string }>;
    onChange: (value: Value | undefined) => void;
    label: string;
    value?: Value;
    hideEmpty?: boolean;
}

const Dropdown: React.FC<DropdownProps> = props => {
    const { items, value, onChange, label, hideEmpty } = props;
    const materialTheme = getMaterialTheme();
    const selectValue =
        value === undefined || !items.map(item => item.value).includes(value) ? "" : value;

    return (
        <MuiThemeProvider theme={materialTheme}>
            <FormControl>
                <InputLabel>{label}</InputLabel>
                <Select
                    value={selectValue}
                    onChange={ev => onChange((ev.target.value as string) || undefined)}
                    MenuProps={{
                        getContentAnchorEl: null,
                        anchorOrigin: {
                            vertical: "bottom",
                            horizontal: "left",
                        },
                    }}
                >
                    {!hideEmpty && <MenuItem value={""}>{i18n.t("<No value>")}</MenuItem>}
                    {items.map(item => (
                        <MenuItem key={item.value} value={item.value}>
                            {item.text}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </MuiThemeProvider>
    );
};

const getMaterialTheme = () =>
    createMuiTheme({
        overrides: {
            MuiFormLabel: {
                root: {
                    color: "#aaaaaa",
                    "&$focused": {
                        color: "#aaaaaa",
                    },
                    top: "-9px !important",
                    marginLeft: 10,
                },
            },
            MuiInput: {
                root: {
                    marginLeft: 10,
                },
                formControl: {
                    minWidth: 150,
                    marginTop: "8px !important",
                },
                input: {
                    color: "#565656",
                },
                underline: {
                    "&&&&:hover:before": {
                        borderBottom: `1px solid #bdbdbd`,
                    },
                    "&:hover:not($disabled):before": {
                        borderBottom: `1px solid #aaaaaa`,
                    },
                    "&:after": {
                        borderBottom: `2px solid ${cyan["500"]}`,
                    },
                    "&:before": {
                        borderBottom: `1px solid #bdbdbd`,
                    },
                },
            },
        },
    });

export default Dropdown;

import React from "react";
import { MenuItem, Select } from "@material-ui/core";
import i18n from "../../locales";
import DropdownForm from "./DropdownForm";

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
    const selectValue =
        value === undefined || !items.map(item => item.value).includes(value) ? "" : value;

    return (
        <DropdownForm label={label}>
            <Select
                value={selectValue}
                onChange={ev => onChange((ev.target.value as string) || undefined)}
                MenuProps={{
                    getContentAnchorEl: null,
                    anchorOrigin: { vertical: "bottom", horizontal: "left" },
                }}
            >
                {!hideEmpty && <MenuItem value={""}>{i18n.t("<No value>")}</MenuItem>}
                {items.map(item => (
                    <MenuItem key={item.value} value={item.value}>
                        {item.text}
                    </MenuItem>
                ))}
            </Select>
        </DropdownForm>
    );
};

export default Dropdown;

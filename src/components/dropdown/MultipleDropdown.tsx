import React from "react";
import { MenuItem, Select, MenuProps } from "@material-ui/core";
import DropdownForm from "./DropdownForm";

type Value = string;

interface MultipleDropdownProps {
    items: Array<{ value: Value; text: string }>;
    onChange: (values: Value[]) => void;
    label: string;
    values: Value[];
}

const menuProps: Partial<MenuProps> = {
    getContentAnchorEl: null,
    anchorOrigin: { vertical: "bottom", horizontal: "left" },
};

const MultipleDropdown: React.FC<MultipleDropdownProps> = props => {
    const { items, values, onChange, label } = props;
    const notifyChange = React.useCallback(ev => onChange(ev.target.value as string[]), [onChange]);

    return (
        <DropdownForm label={label}>
            <Select
                multiple={true}
                data-test-multiple-dropdown={label}
                value={values}
                onChange={notifyChange}
                MenuProps={menuProps}
            >
                {items.map(item => (
                    <MenuItem key={item.value} value={item.value}>
                        {item.text}
                    </MenuItem>
                ))}
            </Select>
        </DropdownForm>
    );
};

export default React.memo(MultipleDropdown);

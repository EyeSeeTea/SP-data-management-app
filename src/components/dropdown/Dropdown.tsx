import React from "react";
import { MenuItem, Select, SelectProps } from "@material-ui/core";
import i18n from "../../locales";
import DropdownForm from "./DropdownForm";

type Value = string;

export type DropdownItem = { value: Value; text: string };

export interface DropdownProps {
    id?: string;
    items: Array<DropdownItem>;
    onChange: (value: Value | undefined) => void;
    label?: string;
    value?: Value;
    hideEmpty?: boolean;
    hideLabelWhenValueSelected?: boolean;
}

const Dropdown: React.FC<DropdownProps> = props => {
    const { items, value, onChange, hideEmpty, id } = props;
    const { label, hideLabelWhenValueSelected = false } = props;

    const selectValue =
        value === undefined || !items.map(item => item.value).includes(value) ? "" : value;

    const isLabelVisible = hideLabelWhenValueSelected ? !selectValue : true;

    const notifyChange = React.useCallback<NonNullable<SelectProps["onChange"]>>(
        ev => {
            onChange((ev.target.value as string) || undefined);
        },
        [onChange]
    );

    return (
        <SelectWrapper label={label} visible={isLabelVisible}>
            <Select data-cy={id} value={selectValue} onChange={notifyChange} MenuProps={menuProps}>
                {!hideEmpty && <MenuItem value="">{i18n.t("<No value>")}</MenuItem>}

                {items.map(item => (
                    <MenuItem key={item.value} value={item.value}>
                        {item.text}
                    </MenuItem>
                ))}
            </Select>
        </SelectWrapper>
    );
};

const SelectWrapper: React.FC<{ label?: string; visible: boolean }> = props => {
    const { label, visible, children } = props;

    if (label) {
        return <DropdownForm label={visible ? label : ""}>{children}</DropdownForm>;
    } else {
        return <React.Fragment>{children}</React.Fragment>;
    }
};

const menuProps = {
    getContentAnchorEl: null,
    anchorOrigin: { vertical: "bottom", horizontal: "left" },
} as const;

export default React.memo(Dropdown);

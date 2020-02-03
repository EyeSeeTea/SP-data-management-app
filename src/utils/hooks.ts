import React from "react";

interface UseBooleanReturn {
    value: boolean;
    isEnabled: boolean;
    isDisabled: boolean;
    set: (newValue: boolean) => void;
    toggle: () => void;
    enable: () => void;
    disable: () => void;
}

export function useBoolean(initialValue: boolean): UseBooleanReturn {
    const [currentValue, setValue] = React.useState(initialValue);

    return {
        value: currentValue,
        isEnabled: currentValue,
        isDisabled: !currentValue,
        set: setValue,
        enable: () => setValue(true),
        disable: () => setValue(false),
        toggle: () => setValue(value => !value),
    };
}

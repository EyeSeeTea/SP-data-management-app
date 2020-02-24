import React from "react";
import Fab from "@material-ui/core/Fab";

interface ActionButtonProps {
    label: string;
    onClick: () => void;
    style?: React.CSSProperties;
}

const ActionButton: React.FC<ActionButtonProps> = props => {
    const { label, onClick, style } = props;
    const variant = !label || React.isValidElement(label) ? "round" : "extended";

    return (
        <Fab
            color="primary"
            aria-label={label}
            style={style}
            size="large"
            onClick={onClick}
            data-test="list-action-bar"
            variant={variant}
        >
            {label}
        </Fab>
    );
};

export default React.memo(ActionButton);

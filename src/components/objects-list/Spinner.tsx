import React from "react";
import { CircularProgress } from "@material-ui/core";

interface SpinnerProps {
    isVisible: boolean;
}

export const Spinner: React.FunctionComponent<SpinnerProps> = ({ isVisible }) => (
    <React.Fragment>{isVisible && <CircularProgress />}</React.Fragment>
);

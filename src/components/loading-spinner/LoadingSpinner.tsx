import React from "react";
import { CircularProgress } from "@material-ui/core";

interface LoadingSpinnerProps {
    isVisible: boolean;
}

const LoadingSpinner: React.FunctionComponent<LoadingSpinnerProps> = ({ isVisible }) => (
    <React.Fragment>{isVisible && <CircularProgress />}</React.Fragment>
);

export default LoadingSpinner;

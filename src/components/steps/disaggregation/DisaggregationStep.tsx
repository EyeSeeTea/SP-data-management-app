import React from "react";
import { Card, CardContent } from "@material-ui/core";
import { StepProps } from "../../../pages/project-wizard/ProjectWizard";
import { useAppContext } from "../../../contexts/api-context";

const DisaggregationStep: React.FC<StepProps> = ({ project, onChange }) => {
    const { d2, config } = useAppContext();

    return (
        <Card>
            <CardContent>content</CardContent>
        </Card>
    );
};

export default React.memo(DisaggregationStep);

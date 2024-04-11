import React from "react";
import { LinearProgress } from "@material-ui/core";
// @ts-ignore
import { CssVariables } from "@dhis2/ui";
// @ts-ignore
import { SelectionProvider } from "approval-app/es/selection-context";
// @ts-ignore
import { AppProvider } from "approval-app/es/app-context";
// @ts-ignore
import { Layout } from "approval-app/es/app/layout.js";
// @ts-ignore
import { Display } from "approval-app/es/data-workspace/display";
// @ts-ignore
import { useSelectionContext } from "approval-app/es/selection-context";

export interface DataApprovalTableProps {
    dataSetId: string;
    orgUnitId: string;
    period: { startDate: string; endDate: string };
    attributeOptionComboId: string;
}

const DataApprovalTable: React.FC<DataApprovalTableProps> = props => {
    return (
        <>
            <CssVariables spacers colors theme />

            <AppProvider>
                <SelectionProvider disableHistory={true}>
                    <DataValuesTableContents {...props} />
                </SelectionProvider>
            </AppProvider>
        </>
    );
};

const DataValuesTableContents: React.FC<DataApprovalTableProps> = props => {
    const { orgUnitId, dataSetId, period, attributeOptionComboId } = props;
    const selection = useSelectionContext();
    const isSelectionFilled = selection.orgUnit && selection.period;

    React.useEffect(() => {
        if (isSelectionFilled) return;
        selection.selectOrgUnit({ id: orgUnitId });
        selection.selectPeriod(period);
        selection.selectFilter(`ao:${attributeOptionComboId}`);
    }, [selection, isSelectionFilled, orgUnitId, period, attributeOptionComboId]);

    if (!isSelectionFilled) return <LinearProgress />;

    return (
        <Layout.Container>
            <Layout.Content>
                <Display dataSetId={dataSetId} />
            </Layout.Content>
        </Layout.Container>
    );
};

export default React.memo(DataApprovalTable);

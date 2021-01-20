import * as React from "react";

import i18n from "../../locales";
import MerReport, { ExecutiveSummaries } from "../../models/MerReport";
import ReportTextFieldForSector, {
    ReportTextFieldForSectorProps,
} from "../../pages/report/ReportTextFieldForSector";

interface ExecutiveSummariesProps {
    merReport: MerReport;
    onChange(report: MerReport): void;
}

type OnBlurChange = ReportTextFieldForSectorProps<ExecutiveSummaries>["onBlurChange"];

const ExecutiveSummariesComponent: React.FC<ExecutiveSummariesProps> = props => {
    const { merReport, onChange } = props;

    const notifyChange = React.useCallback<OnBlurChange>(
        (_field, value) => {
            const merReportUpdated = merReport.set("executiveSummaries", value);
            onChange(merReportUpdated);
        },
        [merReport, onChange]
    );

    const executiveSummariesInfo = React.useMemo(() => {
        return merReport.getExecutiveSummariesInfo();
    }, [merReport]);

    const onSectorChange = React.useCallback(
        (idx: number, newSectorId: string | undefined) => {
            const sectors = executiveSummariesInfo.map(o => o.sector);
            const newSelected = sectors.map((sector, i) => (idx === i ? newSectorId : sector?.id));
            const merReportUpdated = merReport.set("executiveSummariesSelected", newSelected);
            onChange(merReportUpdated);
        },
        [executiveSummariesInfo, merReport, onChange]
    );

    return (
        <React.Fragment>
            {executiveSummariesInfo.map(({ sector, selectable, value }, idx) => (
                <ReportTextFieldForSector<ExecutiveSummaries>
                    key={idx}
                    title={i18n.t("Executive Summary") + " - "}
                    value={value}
                    field="executiveSummaries"
                    index={idx}
                    parent={merReport.data.executiveSummaries}
                    sector={sector}
                    onBlurChange={notifyChange}
                    onSectorChange={onSectorChange}
                    sectors={selectable}
                ></ReportTextFieldForSector>
            ))}
        </React.Fragment>
    );
};

export default ExecutiveSummariesComponent;

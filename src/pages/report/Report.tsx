import React, { useState } from "react";
import _ from "lodash";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import { useHistory } from "react-router";
import { History } from "history";
import { DatePicker } from "d2-ui-components";
import MerReport, { MerReportData } from "../../models/MerReport";
import { useAppContext } from "../../contexts/api-context";
import UserOrgUnits from "../../components/org-units/UserOrgUnits";
import { Ref } from "d2-api";
import moment from "moment";
import ReportDataTable from "../../components/report-data-table/ReportDataTable";

type Path = string;

function goTo(history: History, url: string) {
    history.push(url);
}

function getTranslations() {
    return {
        help: i18n.t(`Help message for MER`),
    };
}

function getLastOrgUnit(paths: Path[]): { path: Path } | null {
    return (
        _(paths)
            .map(path => ({ path }))
            .last() || null
    );
}

const Report: React.FC = () => {
    const history = useHistory();
    const goToLandingPage = () => goTo(history, "/");
    const { api, config, isDev } = useAppContext();
    const translations = getTranslations();
    const [merReport, merReportSet] = useState<MerReport>(
        MerReport.create(api, config, isDev ? devReport : {})
    );
    const { date, organisationUnit } = merReport.data;

    function onChange<Field extends keyof MerReportData>(field: Field, val: MerReportData[Field]) {
        merReportSet(merReport.set(field, val));
    }

    return (
        <React.Fragment>
            <PageHeader
                title={i18n.t("Monthly Executive Report")}
                help={translations.help}
                onBackClick={goToLandingPage}
            />
            <DatePicker
                label={i18n.t("Date")}
                value={date ? date.toDate() : null}
                onChange={date => onChange("date", date)}
                format="MMMM YYYY"
                views={["year", "month"]}
            />
            {date && (
                <UserOrgUnits
                    onChange={paths => onChange("organisationUnit", getLastOrgUnit(paths))}
                    selected={organisationUnit ? [organisationUnit.path] : []}
                    selectableLevels={[2]}
                />
            )}
            {date && organisationUnit && <ReportDataTable merReport={merReport} />}
        </React.Fragment>
    );
};

const devReport = {
    date: moment(),
    organisationUnit: { path: "/J0hschZVMBt/PJb0RtEnqlf" },
};

export default Report;

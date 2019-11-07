import React from "react";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import { useHistory } from "react-router";
import { History } from "history";

function goTo(history: History, url: string) {
    history.push(url);
}

const Report: React.FC = () => {
    const history = useHistory();
    const goToLandingPage = () => goTo(history, "/");

    return (
        <React.Fragment>
            <PageHeader title={i18n.t("Monthly Executive Report")} onBackClick={goToLandingPage} />
        </React.Fragment>
    );
};

export default Report;

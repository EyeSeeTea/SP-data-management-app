import React from "react";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import { useHistory } from "react-router";
import { History } from "history";

function goTo(history: History, url: string) {
    history.push(url);
}

// function getConfig() {
//     const help = i18n.t(
//         `Select a) organizational unit where vaccination was performed, b) data set, c) date of vaccination, d) team that performed vaccination

//         Then enter data for the fields shown in the screen.`
//     );

//     return { help };
// }

const Report: React.FC = () => {
    const history = useHistory();
    const goToLandingPage = () => goTo(history, "/");
    // const config = getConfig();

    return (
        <React.Fragment>
            <PageHeader
                title={i18n.t("Monthly Executive Report")}
                // help={config.help}
                onBackClick={goToLandingPage}
            />
        </React.Fragment>
    );
};

export default Report;

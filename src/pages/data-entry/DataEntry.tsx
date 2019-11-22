import React from "react";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import { useHistory } from "react-router";
import { History } from "history";
import TargetValues from "../target-values/TargetValues";

function goTo(history: History, url: string) {
    history.push(url);
}

const DataEntry: React.FC = () => {
    const history = useHistory();
    const goBack = () => goTo(history, "/projects");
    const help = i18n.t(
        `Select a) organizational unit where project was performed, b) data set, c) date, d) current/target

        Then enter data for the fields shown in the screen.`
    );
    const subtitle = i18n.t(
        `Once cells turn into green, all information is saved and you can leave the Data Entry Section`
    );

    return (
        <React.Fragment>
            <PageHeader title={i18n.t("Data Entry test")} help={help} onBackClick={goBack} />
            <div style={stylesSubtitle}>{subtitle}</div>
            <TargetValues />
        </React.Fragment>
    );
};
const stylesSubtitle = { marginBottom: 10, marginLeft: 15 };

export default DataEntry;

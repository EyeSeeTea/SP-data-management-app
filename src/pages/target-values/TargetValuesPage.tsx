import React from "react";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import { History } from "history";
import { useHistory } from "react-router";
import TargetValues from "../target-values/TargetValues";

function goTo(history: History, url: string) {
    history.push(url);
}

const TargetValuesPage: React.FC = () => {
    const title = i18n.t("Set Target Values for Project");
    const subtitle = i18n.t(`This is just an example of a description`);
    const help = i18n.t(
        `This is just an example of a help instruction: Register your target values for this project`
    );
    const history = useHistory();
    const goBack = () => goTo(history, "/projects");

    return (
        <React.Fragment>
            <PageHeader title={title} help={help} onBackClick={goBack} />
            <div style={stylesSubtitle}>{subtitle}</div>
            <TargetValues />
        </React.Fragment>
    );
};
const stylesSubtitle = { marginBottom: 10, marginLeft: 15 };

export default TargetValuesPage;

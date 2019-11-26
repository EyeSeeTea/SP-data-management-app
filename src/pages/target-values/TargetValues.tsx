import React from "react";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import { History } from "history";
import { useHistory } from "react-router";
import DataEntry from "../../components/data-entry/DataEntry";

function goTo(history: History, url: string) {
    history.push(url);
}

const TargetValuesPage: React.FC = () => {
    const title = i18n.t("Set Target Values for Project");
    const subtitle = i18n.t(`This is just an example of a description`);
    const help = i18n.t(`This is an example of help message.`);
    const history = useHistory();
    const goBack = () => goTo(history, "/projects");

    const orgUnitId = "YratZYNMnk7";
    const datasetId = "Dhu7bwd7aXc";
    return (
        <React.Fragment>
            <PageHeader title={title} help={help} onBackClick={goBack} />
            <div style={stylesSubtitle}>{subtitle}</div>
            <DataEntry orgUnitId={orgUnitId} datasetId={datasetId} />
        </React.Fragment>
    );
};
const stylesSubtitle = { marginBottom: 10, marginLeft: 15 };

export default TargetValuesPage;

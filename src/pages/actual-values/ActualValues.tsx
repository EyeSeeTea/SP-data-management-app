import React from "react";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import { useHistory } from "react-router";
import { History } from "history";
import DataEntry from "../../components/data-entry/DataEntry";

function goTo(history: History, url: string) {
    history.push(url);
}

const ActualValues: React.FC = () => {
    const history = useHistory();
    const goBack = () => goTo(history, "/projects");
    const help = i18n.t(`This is an example of help message.`);
    const subtitle = i18n.t(
        `Once cells turn into green, all information is saved and you can leave the Data Entry Section`
    );
    const orgUnitId = "xJAERyCHClH";
    const datasetId = "IJJ2atBo1BS";

    return (
        <React.Fragment>
            <PageHeader
                title={i18n.t("Set Actual Values for Project")}
                help={help}
                onBackClick={goBack}
            />
            <div style={stylesSubtitle}>{subtitle}</div>
            <DataEntry orgUnitId={orgUnitId} datasetId={datasetId} />
        </React.Fragment>
    );
};
const stylesSubtitle = { marginBottom: 10, marginLeft: 15 };

export default ActualValues;

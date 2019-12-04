import React, { useState, useEffect } from "react";
import _ from "lodash";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import { History } from "history";
import { useHistory, useRouteMatch } from "react-router";
import DataEntry from "../../components/data-entry/DataEntry";
import { generateUrl } from "../../router";
import { LinearProgress } from "@material-ui/core";
import Project, { DataSetWithPeriods } from "../../models/Project";
import { useAppContext } from "../../contexts/api-context";
import { D2Api, Ref } from "d2-api";
import { Config } from "../../models/Config";

type Type = "target" | "actual";

interface DataValuesProps {
    type: Type;
}

type RouterParams = { id: string };

type GetState<Data> = { loading: boolean; data?: Data; error?: string };
type State = GetState<{ orgUnit: Ref; dataSet: DataSetWithPeriods }>;

const DataValues: React.FC<DataValuesProps> = ({ type }) => {
    const { api, config } = useAppContext();
    const history = useHistory();
    const match = useRouteMatch<RouterParams>();
    const [state, setState] = useState<State>({ loading: true });
    const { data, loading, error } = state;
    const translations = getTranslations(type);
    const attributes = getAttributes(config, type);
    const projectId = match ? match.params.id : null;

    useEffect(() => loadData(projectId, type, api, config, setState), [projectId]);

    return (
        <React.Fragment>
            <PageHeader
                title={translations.title}
                help={translations.help}
                onBackClick={() => goBack(history)}
            />
            <div style={stylesSubtitle}>{translations.subtitle}</div>
            {loading && <LinearProgress />}
            {data && (
                <DataEntry
                    orgUnitId={data.orgUnit.id}
                    dataSet={data.dataSet}
                    attributes={attributes}
                />
            )}
            {error && <p>{error}</p>}
        </React.Fragment>
    );
};

const stylesSubtitle = { marginBottom: 10, marginLeft: 15 };

function goBack(history: History) {
    history.push(generateUrl("projects"));
}

function loadData(
    projectId: string | null | undefined,
    type: Type,
    api: D2Api,
    config: Config,
    setState: React.Dispatch<React.SetStateAction<State>>
) {
    if (!projectId) return;

    Project.getRelations(api, config, projectId)
        .then(relations => {
            const orgUnit = relations.organisationUnit;
            const dataSet = relations.dataSets[type];
            if (orgUnit && dataSet) {
                setState({
                    data: { orgUnit, dataSet },
                    loading: false,
                });
            } else {
                setState({ error: i18n.t("Cannot load project relations"), loading: false });
            }
        })
        .catch(err => setState({ error: err.message || err.toString(), loading: false }));
}

function getTranslations(type: Type) {
    const isTarget = type === "target";
    return {
        title: isTarget
            ? i18n.t("Set Target Values for Project")
            : i18n.t("Set Actual Values for Project"),
        subtitle: i18n.t(
            `Once cells turn into green, all information is saved and you can leave the Data Entry Section`
        ),
        help: i18n.t(`This is an example of help message.`),
    };
}

function getAttributes(config: Config, type: Type) {
    const category = config.categories.targetActual;
    const categoryOption = _(category.categoryOptions)
        .keyBy(co => co.code)
        .getOrFail(type.toUpperCase());
    return { [category.id]: categoryOption.id };
}

export default DataValues;

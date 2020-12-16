import React, { useState, useEffect } from "react";
import _ from "lodash";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import { History } from "history";
import { useHistory, useRouteMatch } from "react-router";
import DataEntry from "../../components/data-entry/DataEntry";
import { generateUrl } from "../../router";
import { LinearProgress } from "@material-ui/core";
import Project, { DataSet, DataSetType } from "../../models/Project";
import { useAppContext } from "../../contexts/api-context";
import { D2Api } from "../../types/d2-api";
import { Config } from "../../models/Config";
import { link } from "../../utils/form";

interface DataValuesProps {
    type: DataSetType;
}

type RouterParams = { id: string };

type GetState<Data> = { loading: boolean; data?: Data; error?: string };

type State = GetState<{
    project: Project;
    name: string;
    orgUnit: { id: string; displayName: string };
    dataSet: DataSet;
}>;

const DataValues: React.FC<DataValuesProps> = ({ type }) => {
    const { api, config } = useAppContext();
    const history = useHistory();
    const match = useRouteMatch<RouterParams>();
    const [state, setState] = useState<State>({ loading: true });
    const { data, loading, error } = state;
    const translations = getTranslations(type, data ? data.name : undefined);
    const attributes = getAttributes(config, type);
    const projectId = match ? match.params.id : null;

    useEffect(() => loadData(projectId, type, api, config, setState), [
        api,
        config,
        type,
        projectId,
    ]);

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
                    project={data.project}
                    dataSetType={type}
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
    type: DataSetType,
    api: D2Api,
    config: Config,
    setState: React.Dispatch<React.SetStateAction<State>>
) {
    if (!projectId) return;

    Project.get(api, config, projectId)
        .catch(_err => null)
        .then(project => {
            const orgUnit = project ? project.orgUnit : null;
            const dataSet = project && project.dataSets ? project.dataSets[type] : null;
            if (project && orgUnit && dataSet) {
                setState({
                    data: { project, name: project.name, orgUnit, dataSet },
                    loading: false,
                });
            } else {
                setState({ error: i18n.t("Cannot load project relations"), loading: false });
            }
        })
        .catch(err => setState({ error: err.message || err.toString(), loading: false }));
}

function getTranslations(type: DataSetType, projectName: string | undefined) {
    const isTarget = type === "target";
    const baseTitle = isTarget
        ? i18n.t("Set Target Values for Project")
        : i18n.t("Set Actual Values for Project");
    const baseHelp = isTarget
        ? i18n.t(
              `If you have questions regarding target data entry, please refer to resources located at this link`
          )
        : i18n.t(
              `If you have questions regarding “actual” data entry, please refer to resources located at this link`
          );
    const help = (
        <p>
            {baseHelp}:
            <br />
            {link("https://sp.box.com/s/xcod7gqube2gqhjir2ymom5waoc0wvtm")}
        </p>
    );
    return {
        title: baseTitle + ": " + (projectName || "..."),
        subtitle: i18n.t(
            `Once cells turn into green, all information is saved and you can leave the Data Entry Section`
        ),
        help,
    };
}

function getAttributes(config: Config, type: DataSetType) {
    const category = config.categories.targetActual;
    const categoryOption = _(category.categoryOptions)
        .keyBy(co => co.code)
        .getOrFail(type.toUpperCase());
    return { [category.id]: categoryOption.id };
}

export default React.memo(DataValues);

import React, { useEffect, useState } from "react";
import { LinearProgress } from "@material-ui/core";
import { useHistory, useRouteMatch } from "react-router";
//@ts-ignore
import { useConfig } from "@dhis2/app-runtime";

import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import { History } from "history";
import { useAppContext } from "../../contexts/api-context";
import Project from "../../models/Project";
import { generateUrl } from "../../router";
import { D2Api } from "../../types/d2-api";
import { Config } from "../../models/Config";

function goTo(history: History, url: string) {
    history.push(url);
}

function getTranslations(projectName: string | undefined) {
    return {
        title: i18n.t("Dashboard for Project") + ": " + (projectName || "..."),
        help: i18n.t(`Data updates in the dashboards every 15 minutes.  If you do not see your data immediately after data entry, please give the system additional time to update.

        If you notice data errors while viewing the dashboards, please return to the home screen and edit the data under the data entry sections for your project.`),
        subtitle: i18n.t(`Dashboard project to analyse your data...`),
    };
}

function autoResizeIframeByContent(iframe: HTMLIFrameElement) {
    const resize = () => {
        const body = iframe?.contentWindow?.document?.body;
        if (iframe && body) {
            const height = body.scrollHeight;
            if (height > 0) iframe.height = height.toString();
        }
    };
    return window.setInterval(resize, 1000);
}

function waitforElementToLoad(iframeDocument: any, selector: string) {
    return new Promise(resolve => {
        const check = () => {
            if (iframeDocument.querySelector(selector)) {
                resolve();
            } else {
                setTimeout(check, 1000);
            }
        };
        check();
    });
}

type RouterParams = { id?: string };

type GetState<Data> = { loading: boolean; data?: Data; error?: string };

type State = GetState<{
    name?: string;
    url: string;
}>;

// type State = { loading: boolean; name?: string; data?: string; error?: string };

const Dashboard: React.FC = () => {
    const { api, config } = useAppContext();
    const match = useRouteMatch<RouterParams>();
    const history = useHistory();
    const stylesSubtitle = { marginBottom: 10, marginLeft: 15 };
    const { baseUrl } = useConfig();
    const [state, setState] = useState<State>({ loading: true });
    const { data, loading, error } = state;

    const translations = getTranslations(data ? data.name : undefined);

    const projectId = match ? match.params.id : null;
    useEffect(() => loadData(baseUrl, projectId, api, config, setState), [projectId]);
    const iframeRef: React.RefObject<HTMLIFrameElement> = React.createRef();

    const setDashboardStyling = async (iframe: any) => {
        const iframeDocument = iframe.contentWindow.document;

        await waitforElementToLoad(iframeDocument, ".app-wrapper");
        const iFrameRoot = iframeDocument.querySelector("#root");
        const iFrameWrapper = iframeDocument.querySelector(".app-wrapper");
        const pageContainer = iframeDocument.querySelector(".page-container-top-margin");
        if (iFrameWrapper.children[0]) iFrameWrapper.children[0].style.display = "none";
        if (iFrameWrapper.children[1]) iFrameWrapper.children[1].style.display = "none";

        pageContainer.style.marginTop = "0px";
        iFrameRoot.style.marginTop = "0px";
    };

    useEffect(() => {
        const iframe = iframeRef.current;

        if (iframe !== null && !loading) {
            iframe.addEventListener("load", setDashboardStyling.bind(null, iframe));
            const intervalId = autoResizeIframeByContent(iframe);
            return () => window.clearInterval(intervalId);
        }
    }, [iframeRef]);

    return (
        <React.Fragment>
            <PageHeader
                title={translations.title}
                help={translations.help}
                onBackClick={() => goTo(history, generateUrl("projects"))}
            />

            <div style={stylesSubtitle}>{translations.subtitle}</div>

            {loading && <LinearProgress />}
            {error && <p>{error}</p>}
            {data && (
                <iframe
                    ref={iframeRef}
                    id="iframe"
                    title={translations.title}
                    src={data.url}
                    height="10000px"
                    style={styles.iframe}
                />
            )}
        </React.Fragment>
    );
};

const styles = {
    iframe: { width: "100%", border: 0, overflow: "hidden" },
};

function loadData(
    baseUrl: string,
    projectId: string | null | undefined,
    api: D2Api,
    config: Config,
    setState: React.Dispatch<React.SetStateAction<State>>
) {
    const setIFrameSrc = (url: string, name?: string) =>
        setState({ data: { name, url }, loading: false });
    const dashboardUrlBase = `${baseUrl}/dhis-web-dashboard`;
    if (projectId) {
        Project.get(api, config, projectId)
            .catch(_err => null)
            .then(project => {
                const dashboard = project ? project.dashboard : null;
                if (project && dashboard) {
                    setIFrameSrc(dashboardUrlBase + `/#/${dashboard.id}`, project.name);
                } else {
                    setState({
                        error: i18n.t("Cannot load project relations"),
                        loading: false,
                    });
                }
            })
            .catch(err => setState({ error: err.message || err.toString(), loading: false }));
    } else {
        setIFrameSrc(dashboardUrlBase);
    }
}

export default React.memo(Dashboard);

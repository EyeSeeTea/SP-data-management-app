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
import { D2Api } from "d2-api";
import { Config } from "../../models/Config";

function goTo(history: History, url: string) {
    history.push(url);
}

function getTranslations() {
    return {
        help: i18n.t(
            `Please click on the grey arrow next to the chart/table title if you want to modify the layout.`
        ),
        subtitle: i18n.t(`Dashboard project to analyse your data...`),
    };
}

function autoResizeIframeByContent(iframe: HTMLIFrameElement) {
    const resize = () => {
        if (iframe.contentWindow) {
            const height = iframe.contentWindow.document.body.scrollHeight;
            iframe.height = height.toString();
        }
    };
    window.setInterval(resize, 1000);
}

function waitforElementToLoad(iframeDocument: any, selector: string) {
    return new Promise(resolve => {
        const check = () => {
            if (iframeDocument.querySelector(selector)) {
                resolve();
            } else {
                setTimeout(check, 10);
            }
        };
        check();
    });
}

function goToBack(history: History, projectId: string | undefined | null) {
    goTo(history, projectId ? generateUrl("projects") : generateUrl("home"));
}

type RouterParams = { id?: string };

type State = { loading: boolean; data?: string; error?: string };

const Dashboard: React.FC = () => {
    const { api, config } = useAppContext();
    const match = useRouteMatch<RouterParams>();
    const history = useHistory();
    const translations = getTranslations();
    const stylesSubtitle = { marginBottom: 10, marginLeft: 15 };
    const { baseUrl } = useConfig();
    const [state, setState] = useState<State>({ loading: true });
    const { data: iFrameSrc, loading, error } = state;

    const projectId = match ? match.params.id : null;
    useEffect(() => loadData(baseUrl, projectId, api, config, setState), [projectId]);
    const iframeRef: React.RefObject<HTMLIFrameElement> = React.createRef();

    const setDashboardStyling = async (iframe: any) => {
        const iframeDocument = iframe.contentWindow.document;

        await waitforElementToLoad(iframeDocument, ".app-wrapper");
        const iFrameRoot = iframeDocument.querySelector("#root");
        const iFrameWrapper = iframeDocument.querySelector(".app-wrapper");
        const pageContainer = iframeDocument.querySelector(".page-container-top-margin");

        iFrameWrapper.removeChild(iFrameWrapper.firstChild).remove();
        iFrameWrapper.removeChild(iFrameWrapper.firstChild).remove();

        pageContainer.style.marginTop = "0px";
        iFrameRoot.style.marginTop = "0px";

        autoResizeIframeByContent(iframe);
    };

    useEffect(() => {
        const iframe = iframeRef.current;

        if (iframe !== null && !loading) {
            iframe.addEventListener("load", setDashboardStyling.bind(null, iframe));
        }
    }, [iframeRef]);

    return (
        <React.Fragment>
            <PageHeader
                title={i18n.t("Dashboard")}
                help={translations.help}
                onBackClick={() => goToBack(history, projectId)}
            />
            <div style={stylesSubtitle}>{translations.subtitle}</div>
            {loading && <LinearProgress />}
            {error && <p>{error}</p>}
            {iFrameSrc && (
                <iframe
                    ref={iframeRef}
                    id="iframe"
                    title={i18n.t("Dashboard")}
                    src={iFrameSrc}
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
    const setIFrameSrc = (url: string) => setState({ data: url, loading: false });
    const dashboardUrlBase = `${baseUrl}/dhis-web-dashboard`;
    if (projectId) {
        Project.getRelations(api, config, projectId)
            .then(({ dashboardId }) => {
                if (dashboardId) {
                    setIFrameSrc(dashboardUrlBase + `/#/${dashboardId}`);
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

export default Dashboard;

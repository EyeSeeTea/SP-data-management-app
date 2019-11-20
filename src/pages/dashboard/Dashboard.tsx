import React, { useEffect, useState } from "react";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import { useHistory } from "react-router";
import { History } from "history";
//@ts-ignore
import { useConfig } from "@dhis2/app-runtime";

function goTo(history: History, url: string) {
    history.push(url);
}

function getConfig() {
    const help = i18n.t(
        `Please click on the grey arrow next to the chart/table title if you want to modify the layout.`
    );

    return { help };
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

const Dashboard: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const history = useHistory();
    const goToLandingPage = () => goTo(history, "/");
    const subtitle = i18n.t(
        `Dashboard project to analyse your data...`
    );
    const stylesSubtitle = { marginBottom: 10, marginLeft: 15 };
    const config = getConfig();
    const { baseUrl } = useConfig();
    const iFrameSrc = `${baseUrl}/dhis-web-dashboard/#/CrpCenwxWwl`;
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
            setLoading(true);
            iframe.addEventListener("load", setDashboardStyling.bind(null, iframe));
        }
    });

    return (
        <React.Fragment>
            <PageHeader
                title={i18n.t("Dashboard")}
                help={config.help}
                onBackClick={goToLandingPage}
            />
            <div style={stylesSubtitle}>{subtitle}</div>
            <iframe
                ref={iframeRef}
                id="iframe"
                title={i18n.t("Dashboard")}
                src={iFrameSrc}
                height="10000px"
                style={styles.iframe}
            />
        </React.Fragment>
    );
};

const styles = {
    iframe: { width: "100%", border: 0, overflow: "hidden" },
};

export default Dashboard;

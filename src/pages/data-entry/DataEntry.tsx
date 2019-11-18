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

function autoResizeIframeByContent(iframe: HTMLIFrameElement) {
    const resize = () => {
        if (iframe.contentWindow) {
            const height = iframe.contentWindow.document.body.scrollHeight;
            iframe.height = height.toString();
        }
    };
    window.setInterval(resize, 1000);
}

function getConfig() {
    const help = i18n.t(
        `Select a) organizational unit where project was performed, b) data set, c) date, d) current/target

        Then enter data for the fields shown in the screen.`
    );

    return { help };
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

const DataEntry: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const history = useHistory();
    const goToLandingPage = () => goTo(history, "/");
    const config = getConfig();
    const subtitle = i18n.t(
        `Once cells turn into green, all information is saved and you can leave the Data Entry Section`
    );
    const stylesSubtitle = { marginBottom: 10, marginLeft: 15 };
    const iframeRef: React.RefObject<HTMLIFrameElement> = React.createRef();
    const { baseUrl } = useConfig();
    const iFrameSrc = `${baseUrl}/dhis-web-dataentry/index.action`;

    const setDashboardStyling = async (iframe: any) => {
        const iframeDocument = iframe.contentWindow.document;

        await waitforElementToLoad(iframeDocument, "#selectedDataSetId");
        iframeDocument.querySelector("#header").remove();
        iframeDocument.querySelector("#leftBar").style.display = "none";
        iframeDocument.querySelector("body").style.marginTop = "-55px";
        iframeDocument.querySelector("html").style.overflow = "hidden";

        iframeDocument.querySelector("#moduleHeader").remove();
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
                title={i18n.t("Data Entry")}
                help={config.help}
                onBackClick={goToLandingPage}
            />
            <div style={stylesSubtitle}>{subtitle}</div>
            <iframe
                ref={iframeRef}
                id="iframe"
                title={i18n.t("Data Entry")}
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
export default DataEntry;

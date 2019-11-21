import React, { useEffect, useState } from "react";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
// import { Button } from "@material-ui/core";
import { useHistory } from "react-router";
import { History } from "history";
//@ts-ignore
import { useConfig } from "@dhis2/app-runtime";

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
function goTo(history: History, url: string) {
    history.push(url);
}

const TargetValues: React.FC = () => {
    const title = i18n.t("Set Target Values for Project");
    const subtitle = i18n.t(`This is just an example of a description`);
    const stylesSubtitle = { marginBottom: 10, marginLeft: 15 };
    const [loading, setLoading] = useState(false);
    const { baseUrl } = useConfig();
    const iFrameSrc = `${baseUrl}/dhis-web-dataentry/index.action`;

    const iframeRef: React.RefObject<HTMLIFrameElement> = React.createRef();
    const setEntryStyling = async (iframe: any) => {
        const iframeDocument = iframe.contentWindow.document;

        await waitforElementToLoad(iframeDocument, "#selectedDataSetId");
        iframeDocument.querySelector("#header").remove();
        iframeDocument.querySelector("#actions").remove();
        iframeDocument.querySelector("#moduleHeader").remove();
        // iframeDocument.querySelector("#leftBar").style.display = "none";
        iframeDocument.querySelector("html").style.overflow = "hidden";

        iframeDocument.querySelector("body").style.marginTop = "-55px";
        autoResizeIframeByContent(iframe);
    };
    const help = i18n.t(
        `This is just an example of a help instruction: Register your target values for this project`
    );
    const history = useHistory();
    const goBack = () => goTo(history, "/projects");

    useEffect(() => {
        const iframe = iframeRef.current;
        if (iframe !== null && !loading) {
            setLoading(true);
            iframe.addEventListener("load", setEntryStyling.bind(null, iframe));
        }
    });

    return (
        <React.Fragment>
            <PageHeader title={title} help={help} onBackClick={goBack} />
            <div style={stylesSubtitle}>{subtitle}</div>
            <div style={styles.backgroundIframe}>
                <iframe
                    ref={iframeRef}
                    title="Target Values"
                    src={iFrameSrc}
                    style={styles.iframe}
                ></iframe>
                {/* <Button autoFocus>{i18n.t("Close")}</Button>
                <Button>{i18n.t("Save")}</Button> */}
            </div>
        </React.Fragment>
    );
};

const styles = {
    iframe: { width: "100%", border: 0, overflow: "hidden" },
    backgroundIframe: { backgroundColor: "white" },
};

export default TargetValues;

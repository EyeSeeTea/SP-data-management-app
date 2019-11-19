import React, { useEffect, useState } from "react";
import i18n from "../locales";
import { DialogTitle, DialogContent, CardContent, Hidden } from "@material-ui/core";
import Linkify from "react-linkify";
import { CSSProperties } from "@material-ui/styles";

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

const TargetValues: React.FC = () => {
    const title = i18n.t("Set Target Population Name of Organit Unit");
    const description = i18n.t(
        `Insert the age distribution for your project(s).
        Insert the target population for each of the sites.
        Age distribution at project level will be used for all sites within that project.
        Age distribution can be modified for any of the sites if needed.

        If you leave this page and return to it again you might find that information is not updated yet. Do not worry, information was not lost, updated information will appear within a few minutes.

        The source of data may be {{- hyperlink}} or you may have access to local estimates (i.e. Ministry of Health)`,
        {
            hyperlink: "https://hmisocba.msf.es/external-static/Denominators_Tool_OCBA.xlsm",
        }
    );
    const [loading, setLoading] = useState(false);
    const iframeRef: React.RefObject<HTMLIFrameElement> = React.createRef();
    const setDashboardStyling = async (iframe: any) => {
        const iframeDocument = iframe.contentWindow.document;
        // iframeDocument.querySelector("#header").remove();

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
        if (iframe) {
            iframe.style.height = "100vh";
        }

        if (iframe !== null && !loading) {
            setLoading(true);
            iframe.addEventListener("load", setDashboardStyling.bind(null, iframe));
        }
    });
    return (
        <React.Fragment>
            <div style={styleBackground}>
                <CardContent style={styleCard}>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogContent>
                        <React.Fragment>
                            <Linkify>{description}</Linkify>
                            <iframe
                                // id="iframe"
                                ref={iframeRef}
                                src="http://localhost:8080/dhis-web-dataentry/index.action"
                                style={styles.iframe}
                            />
                            <CardContent />
                        </React.Fragment>
                    </DialogContent>
                </CardContent>
            </div>
        </React.Fragment>
    );
};

const styles = {
    iframe: { width: "100%", border: 0, overflow: "hidden" },
};

const styleCard: CSSProperties = {
    backgroundColor: "white",
    padding: "5px 5px 5px 5px",
    position: "absolute",
    height: "100vh",
};

const styleBackground: CSSProperties = {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    height: "100vh",
    padding: "0",
    margin: "0",
    position: "absolute",
    width: "100%",
    top: "50px",
    left: "0",
};

export default TargetValues;

import React, { useEffect, useState } from "react";
import i18n from "../locales";
import { DialogTitle, DialogContent, CardContent, DialogActions, Button } from "@material-ui/core";
import { CSSProperties } from "@material-ui/styles";
//@ts-ignore
import { useConfig } from "@dhis2/app-runtime";

function autoResizeIframeByContent(iframe: HTMLIFrameElement) {
    const resize = () => {
        if (iframe.contentWindow) {
            const height = iframe.contentWindow.document.body.scrollHeight;
            iframe.style.height = height.toString();
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

const TargetValues: React.FC<{
    closeTargetValues: (event: React.MouseEvent<HTMLButtonElement>) => void;
}> = props => {
    const title = i18n.t("Set Target Values for Project");
    const description = i18n.t(
        `This is just an example of a description`
    );
    const stylesSubtitle = { marginBottom: 10, marginLeft: 15 };
    const [loading, setLoading] = useState(false);
    const closeTargetValues = props.closeTargetValues;
    const { baseUrl } = useConfig();
    const iFrameSrc = `${baseUrl}/dhis-web-dataentry/index.action`;

    const iframeRef: React.RefObject<HTMLIFrameElement> = React.createRef();
    const setEntryStyling = async (iframe: any) => {
        const iframeDocument = iframe.contentWindow.document;

        await waitforElementToLoad(iframeDocument, "#selectedDataSetId");
        iframeDocument.querySelector("#header").remove();
        iframeDocument.querySelector("#actions").remove();
        iframeDocument.querySelector("#moduleHeader").remove();
        iframeDocument.querySelector("#leftBar").style.display = "none";
        iframeDocument.querySelector("#contentDiv").style.overflow = "scroll";
        iframeDocument.querySelector("body").style.marginTop = "-55px";
        iframeDocument
            .querySelector(".backgroundModal")
            .addEventListener("onclick", closeTargetValues);
        iframeDocument.querySelector("#contentDiv").style.overflow = "scroll";
        autoResizeIframeByContent(iframe);
    };
    useEffect(() => {
        const iframe = iframeRef.current;
        if (iframe) {
            iframe.style.height = "100vh";
        }

        if (iframe !== null && !loading) {
            setLoading(true);
            iframe.addEventListener("load", setEntryStyling.bind(null, iframe));
        }
    });
    return (
        <React.Fragment>
            <div className="backgroundModal" style={styleBackground}>
                <CardContent style={styleCard}>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogContent>
                        <React.Fragment>
                            <div style={stylesSubtitle}>{description}</div>
                            <iframe
                                ref={iframeRef}
                                title="Target Values"
                                src={iFrameSrc}
                                style={styles.iframe}
                            />
                            <CardContent />
                        </React.Fragment>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closeTargetValues} autoFocus>
                            {i18n.t("Close")}
                        </Button>
                        <Button>{i18n.t("Save")}</Button>
                    </DialogActions>
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
    padding: "5px",
    width: "90vw",
    position: "absolute",
    borderRadius: "5px",
};

const styleBackground: CSSProperties = {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    height: "100vw",
    padding: "0",
    margin: "0",
    position: "absolute",
    width: "100%",
    top: "50px",
    left: "0",
    display: "flex",
    justifyContent: "center",
};

export default TargetValues;

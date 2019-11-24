import React, { useEffect, useState } from "react";
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
function setEntryStyling(iframeDocument: any) {
    iframeDocument.querySelector("#currentSelection").remove();
    iframeDocument.querySelector("#header").remove();
    iframeDocument.querySelector("html").style.overflow = "hidden";
    iframeDocument.querySelector("#leftBar").style.display = "none";
    // iframeDocument.querySelector("#selectionBox").style.display = "none";
    iframeDocument.querySelector("body").style.marginTop = "-55px";
}

const waitFor = (t: number) => new Promise(resolve => setTimeout(resolve, t));
const waitForChildren = (el: HTMLElement) => {
    return new Promise(resolve => {
        const check = () => {
            if (el.childElementCount > 0) {
                resolve();
            } else {
                setTimeout(check, 10);
            }
        };
        check();
    });
};

const getFormTargetValues = async (iframe: any) => {
    const iframeDocument = iframe.contentWindow.document;

    await waitforElementToLoad(iframeDocument, "#selectedDataSetId");
    setEntryStyling(iframeDocument);
    autoResizeIframeByContent(iframe);

    const iframeSelection = iframe.contentWindow.selection;
    iframeSelection.select("YuQRtpLP10I");

    //get the form that we want
    const dataSetSelector = iframeDocument.querySelector("#selectedDataSetId");
    const periodSelector = iframeDocument.querySelector("#selectedPeriodId");

    await waitForChildren(dataSetSelector);
    await waitforElementToLoad(dataSetSelector, "option");
    iframeDocument.querySelector("#moduleHeader").remove();
    dataSetSelector.value = "BfMAe6Itzgt";
    dataSetSelector.onchange();

    await waitforElementToLoad(periodSelector, "option");
    periodSelector.value = "201910";

    // getting periodSelector options and select it
    await waitFor(10);
    periodSelector.onchange();
    iframe.style.display = "";
};

const TargetValues = () => {
    const [loading, setLoading] = useState(false);

    const { baseUrl } = useConfig();
    const iFrameSrc = `${baseUrl}/dhis-web-dataentry/index.action`;
    const iframeRef: React.RefObject<HTMLIFrameElement> = React.createRef();

    useEffect(() => {
        const iframe = iframeRef.current;

        if (iframe !== null && !loading) {
            iframe.style.display = "none";
            setLoading(true);
            iframe.addEventListener("load", getFormTargetValues.bind(null, iframe));
        }
    });

    return (
        <React.Fragment>
            <iframe ref={iframeRef} src={iFrameSrc} style={styles.iframe}></iframe>
        </React.Fragment>
    );
};

const styles = {
    iframe: { width: "100%", border: 0, overflow: "hidden" },
    backgroundIframe: { backgroundColor: "white" },
};

export default TargetValues;

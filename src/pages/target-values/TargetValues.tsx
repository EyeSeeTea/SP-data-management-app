import React, { useEffect, useState } from "react";
import _ from "lodash";
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

function setEntryStyling(iframe: any) {
    const iframeDocument = iframe.contentWindow.document;
    iframeDocument.querySelector("#currentSelection").remove();
    iframeDocument.querySelector("#header").remove();
    iframeDocument.querySelector("html").style.overflow = "hidden";
    iframeDocument.querySelector("#leftBar").style.display = "none";
    // iframeDocument.querySelector("#selectionBox").style.display = "none";
    iframeDocument.querySelector("body").style.marginTop = "-55px";
    iframeDocument.querySelector("#moduleHeader").remove();
    autoResizeIframeByContent(iframe);
}

const waitForChildren = (el: HTMLSelectElement, datasetId: string) => {
    return new Promise(resolve => {
        const check = () => {
            var option = _.filter(el.options, (option: any) => {
                return option.value === datasetId;
            })[0];
            if (option) {
                resolve();
            } else {
                setTimeout(check, 10);
            }
        };
        check();
    });
};

const setDatasetAndPeriod = async (iframe: any) => {
    const iframeDocument = iframe.contentWindow.document;
    
    // Constants (to be deleted)
    const datasetId = "Dhu7bwd7aXc";
    const period = "201911";

    //get the form that we want
    const dataSetSelector = iframeDocument.querySelector("#selectedDataSetId");
    const periodSelector = iframeDocument.querySelector("#selectedPeriodId");

    // getting datasets options and select it
    await waitForChildren(dataSetSelector, datasetId);
    dataSetSelector.value = datasetId;
    dataSetSelector.onchange();

    // getting periodSelector options and select it
    await waitForChildren(periodSelector, period);
    periodSelector.value = period;
    periodSelector.onchange();
}

const getFormTargetValues = async (iframe: any) => {
    // Constants (to be deleted)
    const orgUnitId = "YratZYNMnk7";

    const iframeSelection = iframe.contentWindow.selection;

    // await waitforElementToLoad(iframeDocument, "#selectedDataSetId");
    setEntryStyling(iframe);

    iframe.contentWindow.dhis2.util.on( 'dhis2.ou.event.orgUnitSelected', async ( event: any, organisationUnitId: any, dv: { value: string; de: string; } ) => {
        if (organisationUnitId[0] == orgUnitId){
            setDatasetAndPeriod(iframe);
        }
        else{
            iframeSelection.select(orgUnitId);
        }

      } );
    iframeSelection.select(orgUnitId);
};

const TargetValues = () => {
    const [loading, setLoading] = useState(false);
    const { baseUrl } = useConfig();
    const iFrameSrc = `${baseUrl}/dhis-web-dataentry/index.action`;
    const iframeRef: React.RefObject<HTMLIFrameElement> = React.createRef();

    useEffect(() => {
        const iframe = iframeRef.current;
        if (iframe !== null && !loading) {
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

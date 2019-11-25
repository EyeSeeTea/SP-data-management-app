import React, { useEffect, useState } from "react";
import _ from "lodash";
//@ts-ignore
import { useConfig } from "@dhis2/app-runtime";
import Dropdown from "../../components/dropdown/Dropdown";

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
    iframeDocument.querySelector("#selectionBox").style.display = "none";
    iframeDocument.querySelector("body").style.marginTop = "-55px";
    iframeDocument.querySelector("#moduleHeader").remove();
    autoResizeIframeByContent(iframe);
}

const waitForChildren = (el: HTMLSelectElement, datasetId: string) => {
    return new Promise(resolve => {
        const check = () => {
            const option = _.filter(el.options, (option: any) => {
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
let dropdownItems: any[] = [];

const obtainDropdownItems = (iframeDocument: HTMLIFrameElement) => {
    const selectedPeriod = iframeDocument.querySelector("#selectedPeriodId") as HTMLSelectElement;
    const options = selectedPeriod.options;
    dropdownItems = [];
    for (const option of options) {
        const item = {
            value: option.value,
            text: option.text,
        };
        dropdownItems.push(item);
    }
};

const setDatasetAndPeriod = async (iframe: any, dropdownValue: string) => {
    const iframeDocument = iframe.contentWindow.document;

    // Constants (to be deleted)
    const datasetId = "Dhu7bwd7aXc";
    const period = dropdownValue;

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

    obtainDropdownItems(iframeDocument);
};

const getFormTargetValues = async (
    iframe: any,
    setDropdownHasValues: Function,
    dropdownValue: string
) => {
    // Constants (to be deleted)
    const orgUnitId = "YratZYNMnk7";

    const iframeSelection = iframe.contentWindow.selection;

    // await waitforElementToLoad(iframeDocument, "#selectedDataSetId");
    setEntryStyling(iframe);

    iframe.contentWindow.dhis2.util.on(
        "dhis2.ou.event.orgUnitSelected",
        async (event: any, organisationUnitId: any) => {
            if (organisationUnitId[0] == orgUnitId) {
                await setDatasetAndPeriod(iframe, dropdownValue);
                setDropdownHasValues();
            } else {
                iframeSelection.select(orgUnitId);
            }
        }
    );
    iframeSelection.select(orgUnitId);
};

const TargetValues = () => {
    const [state, setState] = useState({
        loading: false,
        dropdownHasValues: false,
        dropdownValue: "201911",
    });
    const updateDropdown = (v: any) => {
        const iframe = iframeRef.current;
        if (iframe) {
            const iframeDocument = iframe.contentWindow;
            if (iframeDocument) {
                const periodSelector = iframeDocument.document.querySelector(
                    "#selectedPeriodId"
                ) as HTMLInputElement;
                if (periodSelector) {
                    periodSelector.value = v;
                    if (periodSelector.onchange) periodSelector.onchange({} as Event);
                }
            }
        }

        setState({ ...state, dropdownValue: v });
    };
    const { baseUrl } = useConfig();
    const iFrameSrc = `${baseUrl}/dhis-web-dataentry/index.action`;
    const iframeRef: React.RefObject<HTMLIFrameElement> = React.createRef();

    useEffect(() => {
        const iframe = iframeRef.current;
        const setDropdownHasValues = () => setState({ ...state, dropdownHasValues: true });

        if (iframe !== null && !state.loading) {
            setState({ ...state, loading: true });
            iframe.addEventListener(
                "load",
                getFormTargetValues.bind(null, iframe, setDropdownHasValues, state.dropdownValue)
            );
        }
    });

    return (
        <React.Fragment>
            <div style={styles.selector}>
                {state.dropdownHasValues && (
                    <Dropdown
                        items={dropdownItems}
                        value={state.dropdownValue}
                        onChange={updateDropdown}
                        label="Period"
                        hideEmpty={true}
                    />
                )}{" "}
            </div>
            <iframe
                ref={iframeRef}
                src={iFrameSrc}
                style={styles.iframe}
                title={"Target Value"}
            ></iframe>
        </React.Fragment>
    );
};

const styles = {
    iframe: { width: "100%", border: 0, overflow: "hidden" },
    backgroundIframe: { backgroundColor: "white" },
    selector: { padding: "65px  10px 10px 270px", backgroundColor: "white" },
};

export default TargetValues;

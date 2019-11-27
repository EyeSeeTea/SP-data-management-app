import React, { useEffect, useState } from "react";
import _ from "lodash";
import Spinner from "../spinner/Spinner";
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
    iframeDocument.querySelector("#mainPage").style.margin = "65px 10px 10px 10px";
    iframeDocument.querySelector("#completenessDiv").style.backgroundColor = "#5c9ccc";
    iframeDocument.querySelector("#completenessDiv").style.border = "#5c9ccc";
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

const setDatasetAndPeriod = async (iframe: any, datasetId: string, dropdownValue: string) => {
    const iframeDocument = iframe.contentWindow.document;

    // Constants (to be deleted)
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

const getDataEntryForm = async (
    iframe: any,
    datasetId: string,
    orgUnitId: any,
    setDropdownHasValues: Function,
    dropdownValue: string
) => {

    const iframeSelection = iframe.contentWindow.selection;
    setEntryStyling(iframe);

    iframe.contentWindow.dhis2.util.on(
        "dhis2.ou.event.orgUnitSelected",
        async (event: any, organisationUnitId: any) => {
            if (organisationUnitId[0] == orgUnitId) {
                await setDatasetAndPeriod(iframe, datasetId, dropdownValue);
                setDropdownHasValues();
            } else {
                iframeSelection.select(orgUnitId);
            }

        }
    );
    iframeSelection.select(orgUnitId);
};

const DataEntry = (props: { orgUnitId: any; datasetId: string }) => {
    const { orgUnitId, datasetId } = props;
    const [state, setState] = useState({
        loading: false,
        dropdownHasValues: false,
        dropdownValue: "201910",
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
            iframe.style.display = "none";
            setState({ ...state, loading: true });
            iframe.addEventListener(
                "load",
                getDataEntryForm.bind(
                    null,
                    iframe,
                    datasetId,
                    orgUnitId,
                    setDropdownHasValues,
                    state.dropdownValue
                )
            );
        }
        if (iframe !== null && state.dropdownHasValues) {
            iframe.style.display = "";
        }
    });

    return (
        <React.Fragment>
            <div style={styles.selector}>
                {!state.dropdownHasValues && <Spinner isLoading={state.loading} />}
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
    selector: { padding: "65px  10px 10px 5px", backgroundColor: "white" },
};

export default DataEntry;

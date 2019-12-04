import React, { useEffect, useState } from "react";
import moment from "moment";
import _ from "lodash";
import Spinner from "../spinner/Spinner";
//@ts-ignore
import { useConfig } from "@dhis2/app-runtime";
import Dropdown from "../../components/dropdown/Dropdown";
import { DataSetWithPeriods } from "../../models/Project";

type Attributes = Record<string, string>;

interface DataEntryProps {
    orgUnitId: string;
    dataSet: DataSetWithPeriods;
    attributes: Attributes;
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

const waitForChildren = (el: HTMLSelectElement, value: string) => {
    return new Promise(resolve => {
        const check = () => {
            const option = _.filter(el.options, (option: any) => {
                return option.value === value;
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

const stubEvent = new Event("stub");

const setDatasetPeriodAndCategory = async (
    iframe: HTMLIFrameElement,
    dataSet: DataSetWithPeriods,
    attributes: Attributes,
    onDone: () => void
) => {
    if (!iframe.contentWindow) return;
    const iframeDocument = iframe.contentWindow.document;

    //get the form that we want
    const dataSetSelector = iframeDocument.querySelector<HTMLSelectElement>("#selectedDataSetId");
    const periodSelector = iframeDocument.querySelector<HTMLSelectElement>("#selectedPeriodId");
    if (!dataSetSelector || !periodSelector) return;

    // getting datasets options and select it
    await waitForChildren(dataSetSelector, dataSet.id);
    dataSetSelector.value = dataSet.id;
    if (dataSetSelector.onchange) dataSetSelector.onchange(stubEvent);

    // getting periodSelector options and select it
    periodSelector.querySelectorAll("option").forEach(option => periodSelector.removeChild(option));
    const periods = _.sortBy(dataSet.dataInputPeriods.map(dip => dip.period.id));
    periods.forEach(period => {
        const option = document.createElement("option");
        option.value = period;
        option.innerHTML = period;
        periodSelector.appendChild(option);
    });

    await waitForChildren(periodSelector, periods[0]);
    periodSelector.value = periods[0];
    if (periodSelector.onchange) periodSelector.onchange(stubEvent);

    _(attributes).each(async (categoryOptionId, categoryId) => {
        const selector = iframeDocument.querySelector<HTMLSelectElement>("#category-" + categoryId);
        if (!selector) {
            console.error(`Cannot find attribute selector with categoryId=${categoryId}`);
            return;
        } else {
            selector.value = categoryOptionId;
            if (selector.onchange) selector.onchange(stubEvent);
        }
    });

    onDone();
};

const getDataEntryForm = async (
    iframe: any,
    dataSet: DataSetWithPeriods,
    orgUnitId: any,
    attributes: Attributes,
    onDone: () => void
) => {
    const iframeSelection = iframe.contentWindow.selection;

    setEntryStyling(iframe);

    iframe.contentWindow.dhis2.util.on(
        "dhis2.ou.event.orgUnitSelected",
        async (event: any, organisationUnitId: any) => {
            if (organisationUnitId[0] == orgUnitId) {
                await setDatasetPeriodAndCategory(iframe, dataSet, attributes, onDone);
            } else {
                iframeSelection.select(orgUnitId);
            }
        }
    );
    iframeSelection.select(orgUnitId);
};

const DataEntry = (props: DataEntryProps) => {
    const { orgUnitId, dataSet, attributes } = props;
    const { periodIds, currentPeriodId } = getPeriodsData(dataSet);

    const [state, setState] = useState({
        loading: false,
        dropdownHasValues: false,
        dropdownValue: currentPeriodId,
    });

    useEffect(() => setSelectPeriod(iframeRef, state.dropdownValue), [state]);

    const { baseUrl } = useConfig();
    const iFrameSrc = `${baseUrl}/dhis-web-dataentry/index.action`;
    const iframeRef: React.RefObject<HTMLIFrameElement> = React.createRef();

    useEffect(() => {
        const iframe = iframeRef.current;

        if (iframe !== null && !state.loading) {
            iframe.style.display = "none";
            setState({ ...state, loading: true });
            iframe.addEventListener("load", () => {
                getDataEntryForm(iframe, dataSet, orgUnitId, attributes, () =>
                    setState({ ...state, dropdownHasValues: true })
                );
            });
        }
        if (iframe !== null && state.dropdownHasValues) {
            iframe.style.display = "";
        }
    }, [iframeRef, state]);

    const periodItems = periodIds.map(periodId => ({
        text: moment(periodId, "YYYYMM").format("MMMM YYYY"),
        value: periodId,
    }));

    return (
        <React.Fragment>
            <div style={styles.selector}>
                {!state.dropdownHasValues && <Spinner isLoading={state.loading} />}
                {state.dropdownHasValues && (
                    <Dropdown
                        items={periodItems}
                        value={state.dropdownValue}
                        onChange={value => setState({ ...state, dropdownValue: value })}
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

function setSelectPeriod(
    iframeRef: React.RefObject<HTMLIFrameElement>,
    dropdownValue: string | undefined
) {
    const iframe = iframeRef.current;
    if (iframe) {
        const iframeDocument = iframe.contentWindow;
        if (iframeDocument) {
            const periodSelector = iframeDocument.document.querySelector(
                "#selectedPeriodId"
            ) as HTMLInputElement;
            if (periodSelector && dropdownValue) {
                periodSelector.value = dropdownValue;
                if (periodSelector.onchange) periodSelector.onchange({} as Event);
            }
        }
    }
}

function getPeriodsData(dataSet: DataSetWithPeriods) {
    const periodIds = _.sortBy(dataSet.dataInputPeriods.map(dip => dip.period.id));
    const isTarget = dataSet.code.endsWith("TARGET");
    const currentPeriod = moment().format("YYYYMM");

    const currentPeriodId = isTarget
        ? _.first(periodIds)
        : periodIds.includes(currentPeriod)
        ? currentPeriod
        : _.last(periodIds);

    return { periodIds, currentPeriodId };
}

export default DataEntry;

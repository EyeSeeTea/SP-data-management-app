import React, { useEffect, useState } from "react";
import moment from "moment";
import _ from "lodash";
import Spinner from "../spinner/Spinner";
import Dropdown from "../../components/dropdown/Dropdown";
import Project, { DataSet, monthFormat, getPeriodsData, DataSetType } from "../../models/Project";
import DataSetStateButton from "./DataSetStateButton";
import { useAppContext } from "../../contexts/api-context";
import i18n from "../../locales";
import { ValidationDialog } from "./ValidationDialog";
import { useValidation } from "./validation-hooks";

const showControls = false;

type Attributes = Record<string, string>;

interface DataEntryProps {
    orgUnitId: string;
    project: Project;
    dataSetType: DataSetType;
    dataSet: DataSet;
    attributes: Attributes;
    onValidateFnChange(validateFn: ValidateFn): void;
}

export type ValidateFn = { execute: () => void };

function autoResizeIframeByContent(iframe: HTMLIFrameElement) {
    const resize = () => {
        if (iframe.contentWindow) {
            const height = iframe.contentWindow.document.body.scrollHeight;
            if (height > 0) iframe.height = height.toString();
        }
    };
    window.setInterval(resize, 1000);
}

function on<T extends HTMLElement>(document: Document, selector: string, action: (el: T) => void) {
    const el = document.querySelector(selector) as T;
    if (el) action(el);
}

function setEntryStyling(iframe: HTMLIFrameElement) {
    if (!iframe.contentWindow) return;
    const iframeDocument = iframe.contentWindow.document;
    autoResizeIframeByContent(iframe);

    if (showControls) return;

    on(iframeDocument, "#currentSelection", el => el.remove());
    on(iframeDocument, "#header", el => el.remove());
    on(iframeDocument, "html", html => (html.style["overflowY"] = "hidden"));
    on(iframeDocument, "#leftBar", el => (el.style.display = "none"));
    on(iframeDocument, "#selectionBox", el => (el.style.display = "none"));
    on(iframeDocument, "body", el => (el.style.marginTop = "-55px"));
    on(iframeDocument, "#mainPage", el => (el.style.margin = "65px 10px 10px 10px"));
    on(iframeDocument, "#completenessDiv", el => el.remove());
    on(iframeDocument, "#moduleHeader", el => el.remove());
}

export function wait(timeSecs: number) {
    console.debug(`[data-entry] Wait ${timeSecs} seconds`);
    return new Promise(resolve => setTimeout(resolve, 1000 * timeSecs));
}

function waitForOption(el: HTMLSelectElement, predicate: (option: HTMLOptionElement) => boolean) {
    return new Promise(resolve => {
        const check = () => {
            const option = _.find(el.options, predicate);
            if (option) {
                resolve(undefined);
            } else {
                setTimeout(check, 10);
            }
        };
        check();
    });
}

async function setDataset(iframe: HTMLIFrameElement, dataSet: DataSet, onDone: () => void) {
    const contentWindow = iframe.contentWindow as (Window & DataEntryWindow) | null;
    if (!contentWindow) return;

    const iframeDocument = contentWindow.document;
    const dataSetSelector = iframeDocument.querySelector<HTMLSelectElement>("#selectedDataSetId");
    if (!dataSetSelector) return;

    // Avoid database errors
    try {
        await contentWindow.dhis2.de.storageManager.formExists(dataSet.id);
    } catch (err) {
        console.log("[data-entry] error", err);
        setTimeout(() => setDataset(iframe, dataSet, onDone), 500);
    }

    await waitForOption(
        dataSetSelector,
        // data-multiorg is set when the country org unit is still selected
        option => option.value === dataSet.id && !option.getAttribute("data-multiorg")
    );
    await wait(1);
    selectOption(dataSetSelector, dataSet.id);

    onDone();
}

const getDataEntryForm = async (
    iframe: HTMLIFrameElement,
    project: Project,
    dataSet: DataSet,
    orgUnitId: string,
    onDone: () => void
) => {
    const contentWindow = iframe.contentWindow as (Window & DataEntryWindow) | null;
    const iframeDocument = iframe.contentDocument;
    const { parentOrgUnit } = project;
    const iframeSelection = contentWindow ? contentWindow.selection : null;
    if (!contentWindow || !iframeDocument || !iframeSelection || !parentOrgUnit) return;
    const parentSelector = `#orgUnit${parentOrgUnit.id} .toggle`;
    const ouSelector = `#orgUnit${orgUnitId} a`;

    const selectDataSet = async () => {
        console.debug("[data-entry] Select project orgunit", orgUnitId);
        const ouLink = iframeDocument.querySelector<HTMLAnchorElement>(ouSelector);
        if (!ouLink) {
            console.debug("[data-entry] Project orgunit not found, retry");
            selectOrgUnitAndOptions();
        } else {
            ouLink.click();
            console.debug("[data-entry] Select options");
            setDataset(iframe, dataSet, onDone);
        }
    };

    const selectOrgUnitAndOptions = async () => {
        const ouEl = iframeDocument.querySelector(ouSelector);
        if (ouEl) {
            setTimeout(selectDataSet, 100);
        } else {
            const parentEl = iframeDocument.querySelector<HTMLSpanElement>(parentSelector);
            if (parentEl) {
                console.debug("[data-entry] Click country", parentSelector);
                parentEl.click();
                setTimeout(selectOrgUnitAndOptions, 100);
            } else {
                console.debug("[data-entry] Country orgunit not found, wait");
                setTimeout(selectOrgUnitAndOptions, 100);
            }
        }
    };

    selectOrgUnitAndOptions();
};

const DataEntry = (props: DataEntryProps) => {
    const { orgUnitId, dataSet, attributes, dataSetType, onValidateFnChange } = props;
    const { api, config, dhis2Url: baseUrl } = useAppContext();
    const [project, setProject] = useState<Project>(props.project);
    const [iframeKey, setIframeKey] = useState(new Date());
    const [isDataSetOpen, setDataSetOpen] = useState<boolean | undefined>(undefined);
    const { periodIds, currentPeriodId } = React.useMemo(() => getPeriodsData(dataSet), [dataSet]);
    const iframeRef = React.useRef<HTMLIFrameElement>(null);
    const iFrameSrc = `${baseUrl}/dhis-web-dataentry/index.action`;

    const [state, setState] = useState({
        loading: false,
        dropdownHasValues: false,
        dropdownValue: currentPeriodId,
    });

    function reloadIframe() {
        setState(state => ({ ...state, loading: true }));
        setIframeKey(new Date());
        Project.get(api, config, orgUnitId).then(setProject);
    }

    useEffect(() => {
        if (state.dropdownValue) {
            setDataSetOpen(setSelectPeriod(iframeRef.current, state.dropdownValue, attributes));
        }
    }, [state, project, iframeKey, attributes]);

    useEffect(() => {
        const iframe = iframeRef.current;

        if (iframe) {
            if (!showControls) iframe.style.display = "none";
            setState(prevState => ({ ...prevState, loading: true }));
            iframe.addEventListener("load", () => {
                setEntryStyling(iframe);
                getDataEntryForm(iframe, project, dataSet, orgUnitId, () =>
                    setState(prevState => ({ ...prevState, dropdownHasValues: true }))
                );
            });
        }
    }, [iframeKey, dataSet, orgUnitId, project]);

    const period = state.dropdownValue;

    const isValidationEnabled = Boolean(isDataSetOpen) && state.dropdownHasValues;

    const validation = useValidation({
        iframeRef,
        project,
        dataSetType,
        period,
        options: validationOptions,
        iframeKey,
        isValidationEnabled,
    });

    useEffect(() => {
        const iframe = iframeRef.current;

        if (iframe && state.dropdownHasValues) {
            iframe.style.display = "";
        }
    }, [state]);

    const periodItems = React.useMemo(() => {
        return periodIds.map(periodId => ({
            text: moment(periodId, monthFormat).format("MMMM YYYY"),
            value: periodId,
        }));
    }, [periodIds]);

    const { validate } = validation;

    const setPeriod = React.useCallback(
        value => {
            if (!validate({ showValidation: true })) return;
            return setState(prevState => ({ ...prevState, dropdownValue: value }));
        },
        [setState, validate]
    );

    React.useEffect(() => {
        onValidateFnChange({
            execute: () => !isValidationEnabled || validate({ showValidation: true }),
        });
    }, [isValidationEnabled, onValidateFnChange, validate]);

    return (
        <React.Fragment>
            <ValidationDialog result={validation.result} onClose={validation.clear} />

            <div style={styles.selector}>
                {!state.dropdownHasValues && <Spinner isLoading={state.loading} />}

                {state.dropdownHasValues && (
                    <div style={styles.dropdown}>
                        <Dropdown
                            id="month-selector"
                            items={periodItems}
                            value={state.dropdownValue}
                            onChange={setPeriod}
                            label="Period"
                            hideEmpty={true}
                        />
                    </div>
                )}

                {state.dropdownValue && (
                    <div style={styles.buttons}>
                        <DataSetStateButton
                            dataSetType={dataSetType}
                            project={project}
                            dataSet={dataSet}
                            period={state.dropdownValue}
                            onChange={reloadIframe}
                            validation={validation}
                        />
                    </div>
                )}
            </div>

            <iframe
                data-cy="data-entry"
                key={iframeKey.getTime()}
                height={showControls ? 1000 : undefined}
                ref={iframeRef}
                src={iFrameSrc}
                style={isDataSetOpen || showControls ? styles.iframe : styles.iframeHidden}
                title={i18n.t("Data Entry")}
            ></iframe>
        </React.Fragment>
    );
};

const styles = {
    iframe: { width: "100%", border: 0, overflow: "hidden" },
    iframeHidden: { maxHeight: 0, border: 0 },
    backgroundIframe: { backgroundColor: "white" },
    selector: { padding: "35px  10px 10px 5px", backgroundColor: "white" },
    buttons: { display: "inline", marginLeft: 20 },
    dropdown: { display: "inline-block" },
};

function isOptionInSelect(select: HTMLSelectElement, value: string): boolean {
    return Array.from(select.options)
        .map(opt => opt.value)
        .includes(value);
}

function selectOption(select: HTMLSelectElement, value: string) {
    console.debug("[data-entry] selectOption", value, select.options);
    const stubEvent = new Event("stub");
    select.value = value;
    if (select.onchange) select.onchange(stubEvent);
}

/* Globals variables used to interact with the data-entry form */
interface DataEntryWindow {
    dhis2: {
        de: {
            currentPeriodOffset: number;
            storageManager: { formExists: (dataSetId: string) => boolean };
        };
        util: { on: Function };
    };
    displayPeriods: () => void;
    selection: { select: (orgUnitId: string) => void; isBusy(): boolean };
}

function setSelectPeriod(
    iframe: HTMLIFrameElement | null,
    periodKey: string | undefined,
    attributes: Attributes
): boolean {
    if (!iframe || !iframe.contentWindow) return false;

    const iframeWindow = iframe.contentWindow as Window & DataEntryWindow;
    const periodSelector =
        iframeWindow.document.querySelector<HTMLSelectElement>("#selectedPeriodId");

    if (periodSelector && periodKey) {
        const now = moment();
        const selectedDate = moment(periodKey, monthFormat);
        const iframeDocument = iframe.contentWindow.document;
        iframeWindow.dhis2.de.currentPeriodOffset = selectedDate.year() - now.year();
        try {
            iframeWindow.displayPeriods();
        } catch (err) {
            console.error("setSelectPeriod", err);
        }

        if (isOptionInSelect(periodSelector, periodKey)) {
            selectOption(periodSelector, periodKey);

            _(attributes).each((categoryOptionId, categoryId) => {
                const selector = iframeDocument.querySelector("#category-" + categoryId);
                if (!selector) {
                    console.error(`Cannot find attribute selector with categoryId=${categoryId}`);
                } else {
                    selectOption(selector as HTMLSelectElement, categoryOptionId);
                }
            });

            return true;
        } else {
            console.error("Period is not selectable", periodKey);
            return false;
        }
    } else {
        return false;
    }
}

const validationOptions = { interceptSave: true, getOnSaveEvent: true };

export default React.memo(DataEntry);

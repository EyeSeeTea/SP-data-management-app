import React from "react";

export interface PreSaveDataValue {
    dataElementId: string;
    optionComboId: string;
    fieldId: string;
    feedbackId: string | undefined;
}

interface DataValue {
    dataElementId: string;
    categoryOptionComboId: string;
    value: string;
}

export interface AfterSaveDataValue {
    cc: string;
    co: string;
    cp: string;
    de: string;
    ds: string;
    ou: string;
    pe: string;
    value: string;
}

type DataValueSavedMsg = { type: "dataValueSavedFromIframe"; dataValue: AfterSaveDataValue };
type PreSaveDataValueMsg = { type: "preSaveDataValueFromIframe"; dataValue: PreSaveDataValue };
type SaveDataValueMsg = { type: "saveDataValueToIframe"; dataValue: PreSaveDataValue };

type MsgFromIframe = DataValueSavedMsg | PreSaveDataValueMsg;

export type InputMsg =
    | { type: "preSaveDataValue"; dataValue: DataValue }
    | { type: "dataValueSaved"; dataValue: DataValue };
export type OutputMsg = SaveDataValueMsg;

const inputMsgFromIframeTypes: MsgFromIframe["type"][] = [
    "dataValueSavedFromIframe",
    "preSaveDataValueFromIframe",
];

function isInputMsgFromIframe(msg: any): msg is MsgFromIframe {
    return typeof msg === "object" && inputMsgFromIframeTypes.includes(msg.type);
}

export function useDhis2EntryEvents(
    iframeRef: React.RefObject<HTMLIFrameElement>,
    onMessage: (inputMsg: InputMsg) => boolean | undefined
): void {
    const onMessageFromIframe = React.useCallback(
        ev => {
            const iwindow =
                iframeRef.current && (iframeRef.current.contentWindow as DataEntryWindow);
            if (!iwindow) return;
            const { data } = ev;
            if (!isInputMsgFromIframe(data)) return;
            console.debug("|parent|<-", data);

            switch (data.type) {
                case "preSaveDataValueFromIframe": {
                    const value = iwindow.eval<string>(`$("#${data.dataValue.fieldId}").val()`);
                    const dataValue: DataValue = {
                        dataElementId: data.dataValue.dataElementId,
                        categoryOptionComboId: data.dataValue.optionComboId,
                        value,
                    };

                    const inputMsg: InputMsg = { type: "preSaveDataValue", dataValue };
                    const result = onMessage(inputMsg);

                    if (result === false) {
                        console.debug("[preSaveDataValueFromIframe] intercepted");
                    } else {
                        const saveDataValueMsg: SaveDataValueMsg = {
                            type: "saveDataValueToIframe",
                            dataValue: data.dataValue,
                        };
                        console.debug("|parent|->", saveDataValueMsg);
                        iwindow.postMessage(saveDataValueMsg, window.location.origin);
                    }
                    break;
                }
                case "dataValueSavedFromIframe": {
                    const dv = data.dataValue;
                    const dataValue: DataValue = {
                        dataElementId: dv.de,
                        categoryOptionComboId: dv.co,
                        value: dv.value,
                    };

                    const inputMsg: InputMsg = { type: "dataValueSaved", dataValue };
                    onMessage(inputMsg);
                    break;
                }
            }
        },
        [iframeRef.current, onMessage]
    );

    React.useEffect(() => {
        const iframe = iframeRef.current;
        const iwindow = iframe && (iframe.contentWindow as DataEntryWindow);
        if (!iframe || !iwindow || !onMessage) return;

        iframe.addEventListener("load", () => {
            const init = setupDataEntryInterceptors.toString();
            iwindow.eval(`(${init})();`);
        });

        window.addEventListener("message", onMessageFromIframe);

        return () => {
            window.removeEventListener("message", onMessageFromIframe);
        };
    }, [iframeRef.current, onMessageFromIframe]);
}

interface DataEntryWindow extends Window {
    saveVal(
        dataElementId: string,
        optionComboId: string,
        fieldId: string,
        feedbackId: string | undefined
    ): void;
    eval<T>(code: string): T;
    dataEntryHooksInit: boolean;
}

function setupDataEntryInterceptors() {
    const iframeWindow = (window as unknown) as DataEntryWindow;
    if (iframeWindow.dataEntryHooksInit) return;

    iframeWindow
        .jQuery(iframeWindow)
        .on("dhis2.de.event.dataValueSaved", function(
            _ev: unknown,
            _dataSetId: string,
            dataValue: AfterSaveDataValue
        ) {
            const msg: DataValueSavedMsg = {
                type: "dataValueSavedFromIframe",
                dataValue: dataValue,
            };
            console.debug("<-|data-entry|", msg);
            iframeWindow.parent.postMessage(msg, window.location.origin);
        });

    // Wrap saveVal (dhis-web-dataentry/javascript/entry.js)
    const saveValOld = iframeWindow.saveVal;

    iframeWindow.saveVal = function(dataElementId, optionComboId, fieldId, feedbackId) {
        const preSaveDataValue: PreSaveDataValue = {
            dataElementId,
            optionComboId,
            fieldId,
            feedbackId,
        };
        const msg: PreSaveDataValueMsg = {
            type: "preSaveDataValueFromIframe",
            dataValue: preSaveDataValue,
        };
        console.debug("<-|data-entry|", msg);
        iframeWindow.parent.postMessage(msg, window.location.origin);
    };

    window.addEventListener("message", function(ev) {
        const data = ev.data as SaveDataValueMsg;
        console.debug("->|data-entry|", data);
        if (typeof data !== "object") return;

        if (data.type === "saveDataValueToIframe") {
            const { dataElementId, optionComboId, fieldId, feedbackId } = data.dataValue;
            saveValOld(dataElementId, optionComboId, fieldId, feedbackId);
        }
    });

    iframeWindow.dataEntryHooksInit = true;
}

import fs from "fs";
import tmp from "tmp";
import _ from "lodash";
import MockAdapter from "axios-mock-adapter/types";
import { Method } from "axios";

interface MockAdapterWithHandlers extends MockAdapter {
    handlers: Record<Method, Handler[]>;
}

type Url = string;
type Data = object;
type Handler = [Url, Data];

export function logUnknownRequest(mockAdapter: MockAdapter) {
    const mock = mockAdapter as MockAdapterWithHandlers;

    mock.onAny().reply(args => {
        const { method, url, params, data } = args;
        if (!method) return [500, {}];

        const msgs: string[] = [];
        msgs.push(`Error: \n${method?.toUpperCase()} ${url}`);
        if (params) msgs.push(`Params: ${JSON.stringify(params)}`);

        if (data) {
            const dataObj = JSON.parse(data);
            // There may be multiple handlers for a method+URL, guess the most probable object
            const expectedData = _(mock.handlers[method])
                .map(([handlerUrl, handlerData]) => (handlerUrl === url ? handlerData : null))
                .compact()
                .sortBy(handlerData =>
                    // Score by number of common keys between the handler data and the actual data
                    _(handlerData)
                        .keys()
                        .intersection(_.keys(dataObj))
                        .size()
                )
                .reverse()
                .first();

            const expectedPath = writeJsonFile(expectedData, "expected");
            const actualPath = writeJsonFile(dataObj, "actual");
            const msg = `Data: cdiff -u ${expectedPath} ${actualPath}`;
            msgs.push(msg);
        }

        console.debug(msgs.join("\n"));
        return [500, {}];
    });
}

function writeJsonFile(data: any, prefix: string): string {
    const file = tmp.fileSync({ keep: true, prefix: prefix + "-", postfix: ".json" });
    const filePath = file.name;
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(file.fd, json);
    return filePath;
}

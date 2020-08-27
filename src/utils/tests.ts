import fs from "fs";
import MockAdapter from "axios-mock-adapter/types";

export function logUnknownRequest(mock: MockAdapter) {
    mock.onAny().reply(args => {
        const { method, url, params, data } = args;
        const msgs: string[] = [];
        msgs.push(`Error: \n${method?.toUpperCase()} /${url}`);
        if (params) msgs.push(`Params: ${JSON.stringify(params)}`);
        if (data) {
            const json = JSON.stringify(JSON.parse(data), null, 2);
            if (json.length > 100) {
                const n = Math.floor(Math.random() * 1000) + 1;
                const actualPath = `/tmp/actual-${n}.json`;
                fs.writeFileSync(actualPath, json);
                msgs.push(`Data written: ${actualPath}`);
            } else {
                msgs.push(`Data: ${JSON.stringify(JSON.parse(data), null, 2)}`);
            }
        }

        console.debug(msgs.join("\n"));
        return [500, {}];
    });
}

import parse from "parse-typed-args";

import { getApp } from "./common";
import { getConfig } from "../models/Config";
import { getCompositionRoot } from "../CompositionRoot";

async function main() {
    const parser = parse({
        opts: {
            url: {},
            excelPath: {},
            post: { switch: true },
            export: { switch: true },
        },
    });
    const { opts } = parser(process.argv);

    if (!opts.url) return;
    if (!opts.excelPath) return;

    const { api } = await getApp({ baseUrl: opts.url });
    console.info("Loading config. metadata...");
    const config = await getConfig(api);
    const compositionRoot = getCompositionRoot(api, config);
    await compositionRoot.dataElements.import.execute({
        excelPath: opts.excelPath,
        post: opts.post || false,
        export: opts.export || true,
    });
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

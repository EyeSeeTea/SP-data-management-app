import parse from "parse-typed-args";
import { getApp } from "./common";

main().catch(err => {
    console.error(err);
    process.exit(1);
});

async function main() {
    const parser = parse({
        opts: { url: {} },
    });
    const { opts } = parser(process.argv);

    if (!opts.url) return;
    const app = await getApp({ baseUrl: opts.url });
    const { api } = app;
    const { organisationUnits } = await api.metadata
        .get({
            organisationUnits: {
                fields: { id: true },
                filter: { level: { eq: "3" } },
            },
        })
        .getData();

    const orgUnitGroup = {
        id: "xm24UfiG9nf",
        name: "All projects",
        code: "DM_ALL_PROJECTS",
        organisationUnits: organisationUnits,
    };

    const res = await api.metadata
        .post({
            organisationUnitGroups: [orgUnitGroup],
        })
        .getData();

    console.log(res);
}

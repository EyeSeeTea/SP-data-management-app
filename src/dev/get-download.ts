import fs from "fs";
import { getConfig } from "./../models/Config";
import Project from "../models/Project";
import { D2Api } from "../types/d2-api";

async function main() {
    const baseUrl = "http://admin:EsT@Staging1234!@localhost:8032";
    const api = new D2Api({ baseUrl });
    const config = await getConfig(api);
    const project = await Project.get(api, config, "WUDKKsUKqVH");
    const { filename, buffer } = await project.download();
    fs.writeFileSync(filename, buffer as NodeJS.ArrayBufferView);
    console.log(`Written: ${filename}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

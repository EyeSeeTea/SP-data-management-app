import { writeFileSync } from "fs";

export function writeToDisk(path: string, content: unknown) {
    writeFileSync(`${path}.json`, JSON.stringify(content, null, 4));
}

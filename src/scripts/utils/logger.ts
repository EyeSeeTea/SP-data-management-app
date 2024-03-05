import { writeFileSync } from "fs";

export function writeJsonToDisk(path: string, content: unknown) {
    writeFileSync(`${path}.json`, JSON.stringify(content, null, 4));
}

export function writeToDisk(path: string, content: string) {
    writeFileSync(path, addNewLineToEnd(content));
}

export function addNewLineToEnd(content: string): string {
    return content.endsWith("\n") ? content : (content += "\n");
}

export function splitParts(string: string, delimiter: string, n: number) {
    const parts = string.split(delimiter);
    const last = parts.slice(n - 1).join(delimiter);
    return parts.slice(0, n - 1).concat([last]);
}

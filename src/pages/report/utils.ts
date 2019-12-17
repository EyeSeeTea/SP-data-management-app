export function getMultilineRows(s: string | undefined, min: number, max: number): number {
    const nLines = s ? s.split("\n").length : 0;
    return Math.min(Math.max(min, nLines), max);
}

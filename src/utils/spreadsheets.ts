function idOf(idx: number): string {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const quotient = Math.floor(idx / letters.length);
    const remainder = idx % letters.length;
    return (quotient > 0 ? idOf(quotient - 1) : "") + letters[remainder];
}

export function cell(colIdx: number, rowIdx: number): string {
    return idOf(colIdx) + (rowIdx + 1).toString();
}

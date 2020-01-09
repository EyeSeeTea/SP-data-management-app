export function downloadFile(options: { filename: string; buffer: ArrayBuffer }): void {
    const { filename, buffer } = options;
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const element = document.createElement("a");
    element.href = window.URL.createObjectURL(blob);
    element.setAttribute("download", filename);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

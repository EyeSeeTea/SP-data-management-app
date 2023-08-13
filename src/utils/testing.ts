export function isTest(): boolean {
    return process.env.REACT_APP_CYPRESS === "true" || process.env.JEST_WORKER_ID !== undefined;
}

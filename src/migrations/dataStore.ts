import { D2Api } from "../types/d2-api";

export async function getDataStore<T extends object>(
    api: D2Api,
    dataStoreNamespace: string,
    dataStoreKey: string,
    defaultValue: T
): Promise<T> {
    const dataStore = api.dataStore(dataStoreNamespace);
    const value = await dataStore.get<T>(dataStoreKey).getData();
    if (!value) await dataStore.save(dataStoreKey, defaultValue).getData();
    return value ?? defaultValue;
}

export async function saveDataStore(
    api: D2Api,
    dataStoreNamespace: string,
    dataStoreKey: string,
    value: any
): Promise<void> {
    const dataStore = api.dataStore(dataStoreNamespace);
    await dataStore.save(dataStoreKey, value).getData();
}

export async function deleteDataStore(
    api: D2Api,
    dataStoreNamespace: string,
    dataStoreKey: string
): Promise<void> {
    try {
        await api.delete(`/dataStore/${dataStoreNamespace}/${dataStoreKey}`).getData();
    } catch (error) {
        if (!error.response || error.response.status !== 404) {
            throw error;
        }
    }
}

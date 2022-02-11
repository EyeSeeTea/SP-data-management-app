import { D2Api } from "@eyeseetea/d2-api/2.36";
import MockAdapter from "axios-mock-adapter/types";

export * from "@eyeseetea/d2-api/2.36";

export function getMockApi(): { api: D2Api; mock: MockAdapter } {
    const api = new D2Api({ backend: "xhr" });
    const mock = api.getMockAdapter();
    return { api, mock };
}

import { useSnackbar } from "d2-ui-components";
import React from "react";
import { useRouteMatch } from "react-router-dom";
import { useAppContext } from "../../contexts/api-context";
import i18n from "../../locales";
import { withSnackbarOnError } from "../utils/errors";
import { LoaderState } from "../loader/Loader";
import { D2Api } from "../../types/d2-api";
import { Config } from "../../models/Config";
import { Response } from "../../models/Response";

type RouterParams = { id: string };

export interface DashboardObj {
    id: string;
    name: string;
}

export type DashboardState = LoaderState<DashboardObj>;

export type GetDashboard = (
    api: D2Api,
    config: Config,
    id: string
) => Promise<Response<DashboardObj>>;

export function useDashboardFromParams(getDashboard: GetDashboard) {
    const { api, config } = useAppContext();
    const snackbar = useSnackbar();
    const match = useRouteMatch<RouterParams>();
    const [state, setState] = React.useState<DashboardState>({ type: "loading" });
    const id = match.params.id;

    React.useEffect(() => {
        withSnackbarOnError(snackbar, async () => {
            const res = await getDashboard(api, config, id);

            if (res.type === "success") {
                setState({ type: "loaded", data: res.data });
            } else {
                setState({ type: "error" });
                snackbar.error(i18n.t("Cannot load dashboard") + ": " + res.message);
            }
        });
    }, [api, config, id, snackbar, getDashboard]);

    return state;
}

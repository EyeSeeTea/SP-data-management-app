import { useHistory } from "react-router";

const routes = {
    projects: () => "/",
    "projects.new": () => `/projects/new`,
    "projects.edit": ({ id }: { id: string }) => `/projects/${id}`,
    report: () => "/report",
    actualValues: ({ id }: { id: string }) => `/actual-values/${id}`,
    targetValues: ({ id }: { id: string }) => `/target-values/${id}`,
    dashboard: ({ id }: { id: string }) => `/dashboard/${id}`,
    dashboards: () => `/dashboard`,
};

type Routes = typeof routes;
export type GoTo = typeof generateUrl;

export function generateUrl<Name extends keyof Routes>(
    name: Name,
    params: Parameters<Routes[Name]>[0] = undefined
): string {
    const fn = routes[name];
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return params ? fn(params as any) : fn(undefined as any);
}

export function useGoTo(): GoTo {
    const history = useHistory();
    const goTo: GoTo = (name, params) => {
        const url = generateUrl(name, params);
        history.push(url);
        return url;
    };
    return goTo;
}

const routes = {
    projects: () => "/projects",
    "projects.new": () => `/projects/new`,
    "projects.edit": ({ id }: { id: string }) => `/projects/${id}`,
    report: () => "/report",
    dataEntry: () => "/data-entry",
    // "dataEntry.edit": ({ id }: { id: string }) => `/dataEntry/${id}`,
    targetValues: () => "/target-values",
    // "targetValues.edit": ({ id }: { id: string }) => `/targetValues/${id}`,
    dashboard: () => "/dashboard",
};

type Routes = typeof routes;

export function generateUrl<Name extends keyof Routes>(
    name: Name,
    params: Parameters<Routes[Name]>[0] = undefined
): string {
    const fn = routes[name];
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return params ? fn(params as any) : fn(undefined as any);
}

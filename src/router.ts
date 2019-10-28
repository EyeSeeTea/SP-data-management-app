const routes = {
    projects: ({  }: {}) => "/projects",
    "projects.new": ({  }: {}) => `/projects/new`,
    "projects.edit": ({ id }: { id: string }) => `/projects/${id}`,
    report: ({  }: {}) => "/report",
    dataEntry: ({  }: {}) => "/data-entry",
    dashboard: ({  }: {}) => "/dashboard",
};

type Routes = typeof routes;

export function generateUrl<Name extends keyof Routes>(
    name: Name,
    params: Parameters<Routes[Name]>[0] = {}
): string {
    const fn = routes[name];
    return fn.call(null, params as any);
}

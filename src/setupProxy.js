// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createProxyMiddleware } = require("http-proxy-middleware");

const redirectPaths = ["/dhis-web-pivot", "/dhis-web-data-visualizer"];
const envVarName = "REACT_APP_DHIS2_BASE_URL";

module.exports = function (app) {
    const targetUrl = process.env[envVarName];
    if (!targetUrl) {
        console.error(`Set ${envVarName} to base DHIS2 URL`);
        process.exit(1);
    }

    const proxy = createProxyMiddleware({
        target: targetUrl,
        logLevel: "error",
        changeOrigin: true,
        pathRewrite: { "^/dhis2": "/" },
        onProxyReq: function (proxyReq, req, res) {
            const { path } = proxyReq;
            const shouldRedirect = redirectPaths.some(p => path.startsWith(p));

            if (shouldRedirect) {
                const url2 = targetUrl.replace(/\/$/, "") + path;
                res.location(url2);
                res.sendStatus(302);
            }
        },
    });

    app.use(["/dhis2"], proxy);
};

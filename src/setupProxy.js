// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
    const targetUrl = process.env.REACT_APP_DHIS2_BASE_URL;
    if (!targetUrl) return;

    const proxy = createProxyMiddleware({
        target: targetUrl,
        logLevel: "debug",
        changeOrigin: true,
        pathRewrite: { "^/dhis2/": "/" },
    });

    app.use(["/dhis2"], proxy);
};

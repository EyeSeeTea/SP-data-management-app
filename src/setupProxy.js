/* eslint-disable @typescript-eslint/no-var-requires */
const HttpsProxyAgent = require("https-proxy-agent");
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function(app) {
    const proxyServer = process.env.REACT_APP_HTTP_PROXY;
    const targetUrl = process.env.REACT_APP_PROXY_TARGET;
    const authString = process.env.REACT_APP_PROXY_AUTH;

    if (!targetUrl) {
        return;
    } else if (!authString) {
        console.error("Set REACT_APP_PROXY_AUTH=username:password");
        return;
    }

    const auth = Buffer.from(authString).toString("base64");
    const routes = ["/dhis2"];

    const proxy = createProxyMiddleware({
        target: targetUrl,
        changeOrigin: true,
        agent: proxyServer ? new HttpsProxyAgent(proxyServer) : undefined,
        headers: { Authorization: "Basic " + auth },
        pathRewrite: { "^/dhis2/": "/" },
    });

    app.use(routes, proxy);
};

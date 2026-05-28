const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  const backend = {
    target: "http://localhost:3001",
    changeOrigin: true,
  };

  app.use("/api", createProxyMiddleware(backend));
  app.use("/api-docs", createProxyMiddleware(backend));
};

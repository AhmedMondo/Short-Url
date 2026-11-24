const express = require("express");
const path = require("path");
const fs = require("fs");

/**
 * Builds the Express app. Takes a pool and a validated config so tests can
 * inject a fake pool; src/index.js wires the real ones.
 */
function createApp({ pool, config, log = console.log }) {
  const app = express();
  app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");
  app.locals.config = config;
  app.locals.pool = pool;
  app.pool = pool; // kept for route classes (req.app.pool style access)

  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(express.json({ limit: "20kb" }));
  app.use(express.urlencoded({ extended: false, limit: "20kb" }));
  app.use(express.static(path.join(__dirname, "../public")));

  // Auto-load routes from src/routes/. Catch-all routes (last: true) go after the rest.
  const routesDir = path.join(__dirname, "routes");
  const routes = fs
    .readdirSync(routesDir)
    .filter((f) => f.endsWith(".js"))
    .sort()
    .map((file) => new (require(path.join(routesDir, file)))(app));
  routes.sort((a, b) => Number(a.last) - Number(b.last));

  for (const route of routes) {
    const method = route.method.toLowerCase();
    // Async errors are forwarded to the central error handler below.
    app[method](`/${route.name}`, ...route.middleware(app), (req, res, next) =>
      Promise.resolve(route.RouteRun(req, res)).catch(next)
    );
    log(`  [${route.method.toUpperCase()}] /${route.name}`);
  }

  app.get("/", (req, res) => res.sendFile(path.join(__dirname, "../public/index.html")));

  app.use((req, res) => res.status(404).json({ error: "Not found" }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
    console.error("[error]", req.method, req.path, err);
    if (res.headersSent) return next(err);
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

module.exports = { createApp };

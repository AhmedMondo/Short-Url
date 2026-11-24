/**
 * Base Route class.
 *
 * Every route in src/routes/ extends this.  The constructor receives the
 * Express `app` instance (so routes can reach `app.pool`) plus a config
 * object that describes the route.
 *
 * Config fields:
 *  - name        {string}  Express path segment, e.g. "shorten" or "short/:code"
 *  - method      {string}  HTTP verb: "GET" | "POST"
 *  - description {string}  Human-readable description (used in README / logs)
 *  - usage       {string}  Example usage string
 *  - category    {string}  Optional grouping label
 *  - last        {boolean} Register after all other routes (for catch-all paths like "/:code")
 *  - middleware  {function(app): Function[]} Optional per-route Express middleware
 */
class Route {
  constructor(app, config = {}) {
    /** @type {import("express").Application & { pool: import("mysql2/promise").Pool }} */
    this.app = app;

    this.name = config.name || "";
    this.method = config.method || "GET";
    this.description = config.description || "";
    this.usage = config.usage || "";
    this.category = config.category || "Misc";
    this.last = !!config.last;
    this.middleware = config.middleware || (() => []);
  }

  /**
   * Override this in every route subclass.
   * @param {import("express").Request} req
   * @param {import("express").Response} res
   */
  async RouteRun(req, res) {
    res.status(501).json({ error: "Not implemented" });
  }
}

module.exports = Route;

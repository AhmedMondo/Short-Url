const Route = require("../structures/Route");

/** GET /health - liveness plus a database round-trip. 503 when the DB is unreachable. */
class Health extends Route {
  constructor(app) {
    super(app, { name: "health", method: "GET", description: "Health check.", usage: "GET /health" });
  }

  async RouteRun(req, res) {
    try {
      await this.app.pool.query("SELECT 1");
      return res.status(200).json({ status: "ok" });
    } catch (err) {
      console.error("[health]", err.message);
      return res.status(503).json({ status: "unavailable" });
    }
  }
}

module.exports = Health;

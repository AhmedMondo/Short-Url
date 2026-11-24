const Route = require("../structures/Route");
const { isValidCode } = require("../utils/Shortener");
const { findActiveLink, recordClick, passwordPage } = require("../utils/links");

/**
 * GET /short/:code  (also served at GET /:code, see resolveRoot.js)
 *
 * Resolves a short code and redirects (302) to the destination URL.
 * - 400 for a malformed code, 404 for unknown or expired links
 * - Password-protected links serve an HTML form that POSTs back to the same
 *   path. Passwords are NOT accepted in the query string any more.
 */
class ShortenGet extends Route {
  constructor(app, config = {}) {
    super(app, {
      name: "short/:code",
      description: "Resolve a short code and redirect to the destination URL.",
      method: "GET",
      category: "Misc",
      usage: "GET /short/:code",
      ...config,
    });
    this.prefix = config.name ? "" : "/short";
  }

  async RouteRun(req, res) {
    const { code } = req.params;
    if (!isValidCode(code)) return res.status(400).send("Bad request: invalid code format");

    const row = await findActiveLink(this.app.pool, code);
    if (!row) return res.status(404).send("Not Found");

    if (row.password_hash) {
      return res.status(200).type("html").send(passwordPage(`${this.prefix}/${code}`));
    }

    await recordClick(this.app.pool, code);
    return res.redirect(302, row.url);
  }
}

module.exports = ShortenGet;

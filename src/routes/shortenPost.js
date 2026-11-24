const Route = require("../structures/Route");
const { isValidCode, MAX_PASSWORD_LENGTH } = require("../utils/Shortener");
const { findActiveLink, recordClick, checkPassword, passwordPage } = require("../utils/links");
const { limiter } = require("../middleware/rateLimit");

/**
 * POST /short/:code  (also served at POST /:code, see resolveRootPost.js)
 *
 * Handles the password-form submission. Body (urlencoded or JSON): { password }.
 * On success records the click and redirects (303). On failure re-renders the form (401).
 */
class ShortenPost extends Route {
  constructor(app, config = {}) {
    super(app, {
      name: "short/:code",
      description: "Verify password from HTML form then redirect.",
      method: "POST",
      category: "Misc",
      usage: "POST /short/:code  (body: password=<value>)",
      middleware: (a) => [limiter(a.locals.config.rateLimitUnlockPerMin, "Too many attempts, try again in a minute")],
      ...config,
    });
    this.prefix = config.name ? "" : "/short";
  }

  async RouteRun(req, res) {
    const { code } = req.params;
    if (!isValidCode(code)) return res.status(400).send("Bad request: invalid code format");

    const row = await findActiveLink(this.app.pool, code);
    if (!row) return res.status(404).send("Not Found");

    if (!row.password_hash) {
      await recordClick(this.app.pool, code);
      return res.redirect(303, row.url);
    }

    const supplied = req.body && req.body.password;
    const action = `${this.prefix}/${code}`;
    if (typeof supplied !== "string" || !supplied || supplied.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).type("html").send(passwordPage(action, "Password required"));
    }
    if (!(await checkPassword(supplied, row.password_hash))) {
      return res.status(401).type("html").send(passwordPage(action, "Incorrect password. Try again."));
    }

    await recordClick(this.app.pool, code);
    return res.redirect(303, row.url);
  }
}

module.exports = ShortenPost;

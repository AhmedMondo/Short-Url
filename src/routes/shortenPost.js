const Route = require("../structures/Route");
const bcrypt = require("bcrypt");

/**
 * POST /short/:code
 *
 * Handles the HTML password-form submission from the password-gate page.
 * Verifies the password and issues a redirect on success.
 *
 * Body (application/x-www-form-urlencoded):
 *  - password  {string}  The plain-text password to verify.
 */
class ShortenPost extends Route {
  constructor(app) {
    super(app, {
      name: "short/:code",
      description: "Verify password from HTML form then redirect.",
      method: "POST",
      category: "Misc",
      usage: "POST /short/:code  (form body: password=<value>)",
    });
  }

  async RouteRun(req, res) {
    const { code } = req.params;

    // ── Sanitise ──────────────────────────────────────────────────────────────
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      return res.status(400).send("Bad request: invalid code format");
    }

    const supplied = req.body?.password;
    if (!supplied) return res.status(400).send("Password required");

    // ── Fetch link ────────────────────────────────────────────────────────────
    const [rows] = await this.app.pool.query(
      "SELECT url, expires_at, password_hash FROM short_links WHERE code = ? LIMIT 1",
      [code]
    );

    if (!rows.length) return res.status(404).send("Not Found");

    const row = rows[0];

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(404).send("Not Found");
    }

    // ── No password set — just redirect ──────────────────────────────────────
    if (!row.password_hash) {
      return res.redirect(302, row.url);
    }

    // ── Verify password ───────────────────────────────────────────────────────
    const ok = await bcrypt.compare(String(supplied), row.password_hash);
    if (!ok) return res.status(401).send("Invalid password");

    // ── Record click & redirect ───────────────────────────────────────────────
    await this.app.pool.query(
      "UPDATE short_links SET clicks = clicks + 1, last_clicked_at = NOW() WHERE code = ?",
      [code]
    );

    return res.redirect(302, row.url);
  }
}

module.exports = ShortenPost;

const Route = require("../structures/Route");
const { isValidHttpUrl, generateUniqueCode } = require("../utils/Shortener");
const bcrypt = require("bcrypt");

/**
 * POST /shorten
 *
 * Creates a new short link.
 *
 * Request body (JSON):
 *  - url        {string}  Required. The destination URL.
 *  - password   {string}  Optional. Plain-text password; stored as a bcrypt hash.
 *  - expiresAt  {string}  Optional. Expiry date in "YYYY-MM-DD" format.
 *  - code       {string}  Optional. Custom short code. Returns 409 if already taken.
 *
 * Response (200):
 *  { code, url, password (echoed), expires_at }
 */
class Shorten extends Route {
  constructor(app) {
    super(app, {
      name: "shorten",
      description: "Create a shortened URL.",
      method: "POST",
      category: "Misc",
      usage: "POST /shorten",
    });
  }

  async RouteRun(req, res) {
    const { url, password, expiresAt, code } = req.body;

    // ── Validate URL ──────────────────────────────────────────────────────────
    if (!url || !isValidHttpUrl(url)) {
      return res.status(400).json({
        error: "Usage",
        normal: { url: "https://example.com/long-url" },
        withPassword: { url: "https://example.com/long-url", password: "123456" },
        withExpiry: {
          url: "https://example.com/long-url",
          password: "123456",
          expiresAt: "YYYY-MM-DD",
        },
        withCustomCode: {
          url: "https://example.com/long-url",
          password: "123456",
          expiresAt: "YYYY-MM-DD",
          code: "my-link",
        },
      });
    }

    // ── Validate expiry date ──────────────────────────────────────────────────
    if (expiresAt && isNaN(new Date(expiresAt).getTime())) {
      return res.status(400).json({
        error: "expiresAt must be a valid date in the format YYYY-MM-DD",
      });
    }

    const finalCode = code || (await generateUniqueCode(this.app.pool));
    const expires_at = expiresAt ? new Date(expiresAt) : null;

    // ── Hash password if provided ─────────────────────────────────────────────
    let password_hash = null;
    if (password) {
      password_hash = await bcrypt.hash(String(password), 12);
    }

    try {
      await this.app.pool.query(
        "INSERT INTO short_links (code, url, password_hash, expires_at) VALUES (?, ?, ?, ?)",
        [finalCode, url, password_hash, expires_at]
      );

      return res.status(200).json({
        code: finalCode,
        url: `${process.env.SHORT_DOMAIN || "https://go.lous.in"}/${finalCode}`,
        // Echo whether a password was set (never return the hash)
        password_protected: !!password,
        expires_at,
      });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Code already taken" });
      }
      console.error("[shorten]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}

module.exports = Shorten;

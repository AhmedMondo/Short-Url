const Route = require("../structures/Route");
const bcrypt = require("bcrypt");
const {
  isValidHttpUrl, isValidCode, isReservedCode, parseExpiry, makeCode,
  MAX_PASSWORD_LENGTH, MAX_URL_LENGTH,
} = require("../utils/Shortener");
const { requireApiKey } = require("../middleware/auth");
const { limiter } = require("../middleware/rateLimit");

/**
 * POST /shorten
 *
 * Request body (JSON):
 *  - url        {string}  Required. http(s) destination, max 8000 chars.
 *  - password   {string}  Optional. Max 72 chars; stored as a bcrypt hash.
 *  - expiresAt  {string}  Optional. Future date, strictly YYYY-MM-DD (UTC).
 *  - code       {string}  Optional. 1-64 chars [A-Za-z0-9_-]. 409 if taken, 400 if reserved.
 *
 * If API_KEY is configured, send it as `x-api-key` or `Authorization: Bearer`.
 *
 * Response (200): { code, url, password_protected, expires_at }
 */
class Shorten extends Route {
  constructor(app) {
    super(app, {
      name: "shorten",
      description: "Create a shortened URL.",
      method: "POST",
      category: "Misc",
      usage: "POST /shorten",
      middleware: (a) => [
        limiter(a.locals.config.rateLimitCreatePerMin, "Too many requests, try again in a minute"),
        requireApiKey(a.locals.config.apiKey),
      ],
    });
  }

  async RouteRun(req, res) {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { url, password, expiresAt, code } = body;
    const bad = (error) => res.status(400).json({ error });

    if (!isValidHttpUrl(url)) {
      return res.status(400).json({
        error: `url must be a valid http(s) URL up to ${MAX_URL_LENGTH} characters`,
        example: { url: "https://example.com/long-url", password: "optional", expiresAt: "YYYY-MM-DD", code: "optional-slug" },
      });
    }

    let expires_at = null;
    if (expiresAt !== undefined && expiresAt !== null && expiresAt !== "") {
      expires_at = parseExpiry(expiresAt);
      if (!expires_at) return bad("expiresAt must be a real date in the format YYYY-MM-DD");
      if (expires_at.getTime() <= Date.now()) return bad("expiresAt must be in the future");
    }

    if (password !== undefined && password !== null && password !== "") {
      if (typeof password !== "string") return bad("password must be a string");
      if (password.length > MAX_PASSWORD_LENGTH) return bad(`password must be at most ${MAX_PASSWORD_LENGTH} characters`);
    }

    const custom = code !== undefined && code !== null && code !== "";
    if (custom) {
      if (!isValidCode(code)) return bad("code must be 1-64 characters: letters, digits, _ or -");
      if (isReservedCode(code)) return bad("code is reserved");
    }

    const password_hash = password ? await bcrypt.hash(password, 12) : null;
    const attempts = custom ? 1 : 5;

    for (let i = 0; i < attempts; i++) {
      const finalCode = custom ? code : makeCode();
      try {
        await this.app.pool.query(
          "INSERT INTO short_links (code, url, password_hash, expires_at) VALUES (?, ?, ?, ?)",
          [finalCode, url, password_hash, expires_at]
        );
        return res.status(200).json({
          code: finalCode,
          url: `${this.app.locals.config.shortDomain}/${finalCode}`,
          password_protected: !!password_hash,
          expires_at,
        });
      } catch (err) {
        if (err.code !== "ER_DUP_ENTRY") throw err;
        if (custom) return res.status(409).json({ error: "Code already taken" });
      }
    }
    throw new Error("Failed to generate a unique short code after 5 attempts");
  }
}

module.exports = Shorten;

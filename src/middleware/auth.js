const crypto = require("crypto");

/** Requires the configured API key (x-api-key header or Bearer token). No-op when no key is configured. */
function requireApiKey(apiKey) {
  const expected = crypto.createHash("sha256").update(apiKey || "").digest();
  return (req, res, next) => {
    if (!apiKey) return next();
    const header = req.get("authorization") || "";
    const supplied = req.get("x-api-key") || (header.startsWith("Bearer ") ? header.slice(7) : "");
    const got = crypto.createHash("sha256").update(supplied).digest();
    if (!crypto.timingSafeEqual(expected, got)) {
      return res.status(401).json({ error: "Unauthorized: missing or invalid API key" });
    }
    next();
  };
}

module.exports = { requireApiKey };

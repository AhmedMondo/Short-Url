const { customAlphabet } = require("nanoid");

// URL-safe alphanumeric alphabet, 7-char codes -> 62^7 ~ 3.5 trillion combinations
const alphabet =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const makeCode = customAlphabet(alphabet, 7);

const CODE_RE = /^[a-zA-Z0-9_-]{1,64}$/;
// Paths the server uses itself; a custom code may not shadow them.
const RESERVED_CODES = new Set(["health", "shorten", "short", "index.html", "favicon.ico"]);
const MAX_URL_LENGTH = 8000;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores everything after 72 bytes

function isValidHttpUrl(s) {
  if (typeof s !== "string" || s.length > MAX_URL_LENGTH) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidCode(code) {
  return typeof code === "string" && CODE_RE.test(code);
}

function isReservedCode(code) {
  return RESERVED_CODES.has(String(code).toLowerCase());
}

/** Strict YYYY-MM-DD that is a real calendar date. Returns a Date (UTC midnight) or null. */
function parseExpiry(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  return d;
}

/**
 * Legacy helper: random code that does not exist yet (check-then-insert, so it
 * can race). The create route inserts with retry on duplicate instead.
 */
async function generateUniqueCode(pool) {
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    const [rows] = await pool.query("SELECT id FROM short_links WHERE code = ?", [code]);
    if (rows.length === 0) return code;
  }
  throw new Error("Failed to generate a unique short code after 5 attempts");
}

module.exports = {
  isValidHttpUrl, isValidCode, isReservedCode, parseExpiry, generateUniqueCode, makeCode,
  MAX_URL_LENGTH, MAX_PASSWORD_LENGTH,
};

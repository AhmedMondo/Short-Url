const { customAlphabet } = require("nanoid");

// URL-safe alphanumeric alphabet, 7-char codes → 62^7 ≈ 3.5 trillion combinations
const alphabet =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const makeCode = customAlphabet(alphabet, 7);

/**
 * Returns true if `s` is a valid http:// or https:// URL.
 * @param {string} s
 * @returns {boolean}
 */
function isValidHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Generates a 7-character alphanumeric code that doesn't already exist in the
 * `short_links` table.  Retries up to 5 times before throwing.
 *
 * @param {import("mysql2/promise").Pool} pool
 * @returns {Promise<string>}
 */
async function generateUniqueCode(pool) {
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    const [rows] = await pool.query(
      "SELECT id FROM short_links WHERE code = ?",
      [code]
    );
    if (rows.length === 0) return code;
  }
  throw new Error("Failed to generate a unique short code after 5 attempts");
}

module.exports = { isValidHttpUrl, generateUniqueCode };

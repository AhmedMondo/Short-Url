const bcrypt = require("bcrypt");

/** Looks up a link; returns the row, or null when missing or expired. */
async function findActiveLink(pool, code) {
  const [rows] = await pool.query(
    "SELECT url, expires_at, password_hash FROM short_links WHERE code = ? LIMIT 1",
    [code]
  );
  if (!rows.length) return null;
  const row = rows[0];
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
  return row;
}

async function recordClick(pool, code) {
  await pool.query(
    "UPDATE short_links SET clicks = clicks + 1, last_clicked_at = NOW() WHERE code = ?",
    [code]
  );
}

function checkPassword(supplied, hash) {
  return bcrypt.compare(String(supplied), hash);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Password form: submits by POST so the password never lands in URLs or logs. */
function passwordPage(action, error) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="referrer" content="no-referrer" />
  <title>Protected Link</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:ui-monospace,Menlo,monospace;display:grid;place-items:center;min-height:100vh;background:#0a0a0a;color:#f0f0f0}
    .card{background:#111;border:1px solid #222;border-top:2px solid #c8ff00;padding:36px 32px;width:100%;max-width:380px;margin:24px}
    h2{font-size:1.3rem;margin-bottom:6px}
    p{font-size:0.75rem;color:#888;margin-bottom:24px}
    label{display:block;font-size:0.65rem;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:8px}
    input{width:100%;padding:12px 16px;background:#0a0a0a;border:1px solid #222;color:#f0f0f0;font:inherit}
    input:focus{border-color:#c8ff00;outline:none}
    button{width:100%;margin-top:16px;padding:13px;background:#c8ff00;color:#000;font-weight:700;letter-spacing:2px;text-transform:uppercase;border:none;cursor:pointer}
    .err{margin-top:14px;font-size:0.75rem;color:#ff4444;text-align:center}
  </style>
</head>
<body>
  <div class="card">
    <h2>Protected Link</h2>
    <p>This link requires a password to access.</p>
    <form method="POST" action="${escapeHtml(action)}">
      <label for="pw">Password</label>
      <input id="pw" name="password" type="password" placeholder="Enter password" autofocus autocomplete="off" required />
      <button type="submit">Unlock</button>
    </form>
    ${error ? `<div class="err">${escapeHtml(error)}</div>` : ""}
  </div>
</body>
</html>`;
}

module.exports = { findActiveLink, recordClick, checkPassword, passwordPage };

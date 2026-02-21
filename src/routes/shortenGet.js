const Route = require("../structures/Route");
const bcrypt = require("bcrypt");

/**
 * GET /short/:code
 *
 * Resolves a short code and redirects (302) to the destination URL.
 *
 * - Validates the code format (alphanumeric + _ -)
 * - Returns 404 for unknown or expired links
 * - If the link is password-protected and no ?password= query param is
 *   supplied, serves a minimal HTML unlock form.
 * - On a valid password, increments the click counter and redirects.
 */
class ShortenGet extends Route {
  constructor(app) {
    super(app, {
      name: "short/:code",
      description: "Resolve a short code and redirect to the destination URL.",
      method: "GET",
      category: "Misc",
      usage: "GET /short/:code  or  GET /short/:code?password=secret",
    });
  }

  async RouteRun(req, res) {
    const { code } = req.params;

    // ── Sanitise code ─────────────────────────────────────────────────────────
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      return res.status(400).send("Bad request: invalid code format");
    }

    // ── Fetch link ────────────────────────────────────────────────────────────
    const [rows] = await this.app.pool.query(
      "SELECT url, expires_at, password_hash FROM short_links WHERE code = ? LIMIT 1",
      [code]
    );

    if (!rows.length) return res.status(404).send("Not Found");

    const row = rows[0];

    // ── Check expiry ──────────────────────────────────────────────────────────
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(404).send("Not Found");
    }

    // ── Password gate ─────────────────────────────────────────────────────────
    if (row.password_hash) {
      const supplied = req.query?.password;

      if (!supplied) {
        // Serve the password prompt page
        return res
          .status(200)
          .setHeader("Content-Type", "text/html; charset=utf-8")
          .end(passwordPage(code));
      }

      const ok = await bcrypt.compare(String(supplied), row.password_hash);
      if (!ok) return res.status(401).send("Invalid password");
    }

    // ── Record the click ──────────────────────────────────────────────────────
    await this.app.pool.query(
      "UPDATE short_links SET clicks = clicks + 1, last_clicked_at = NOW() WHERE code = ?",
      [code]
    );

    return res.redirect(302, row.url);
  }
}

// ── Password unlock page (inline so the route is fully self-contained) ────────
function passwordPage(code) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Protected Link · go.lous.in</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:'Space Mono',monospace;
      display:grid;place-items:center;
      min-height:100vh;
      background:#0a0a0a;
      color:#f0f0f0;
    }
    body::before{
      content:'';position:fixed;inset:0;
      background-image:
        linear-gradient(rgba(200,255,0,0.03) 1px,transparent 1px),
        linear-gradient(90deg,rgba(200,255,0,0.03) 1px,transparent 1px);
      background-size:40px 40px;pointer-events:none;
    }
    .card{
      position:relative;
      background:#111;
      border:1px solid #222;
      border-radius:2px;
      padding:36px 32px;
      width:100%;max-width:380px;
      margin:24px;
      overflow:hidden;
    }
    .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:#c8ff00}
    .logo{font-family:'Syne',sans-serif;font-weight:800;font-size:1rem;margin-bottom:28px;color:#777}
    .logo span{color:#c8ff00}
    h2{font-family:'Syne',sans-serif;font-weight:700;font-size:1.3rem;letter-spacing:-0.5px;margin-bottom:6px}
    p{font-size:0.75rem;color:#555;margin-bottom:24px;letter-spacing:0.5px}
    label{display:block;font-size:0.65rem;letter-spacing:2px;text-transform:uppercase;color:#555;margin-bottom:8px}
    input{
      width:100%;padding:12px 16px;
      background:#0a0a0a;border:1px solid #222;border-radius:2px;
      color:#f0f0f0;font-family:'Space Mono',monospace;font-size:0.85rem;
      outline:none;transition:border-color .15s;
    }
    input:focus{border-color:#c8ff00}
    button{
      width:100%;margin-top:16px;padding:13px;
      background:#c8ff00;color:#000;
      font-family:'Syne',sans-serif;font-weight:700;font-size:0.85rem;
      letter-spacing:2px;text-transform:uppercase;
      border:none;border-radius:2px;cursor:pointer;transition:background .15s;
    }
    button:hover{background:#d9ff1a}
    .err{display:none;margin-top:14px;font-size:0.75rem;color:#ff4444;text-align:center}
    .err.show{display:block}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">go.<span>lous</span>.in</div>
    <h2>Protected Link</h2>
    <p>This link requires a password to access.</p>
    <form id="f">
      <label for="pw">Password</label>
      <input id="pw" type="password" placeholder="Enter password" autofocus autocomplete="off" />
      <button type="submit">Unlock →</button>
    </form>
    <div class="err" id="err">Incorrect password. Try again.</div>
  </div>
  <script>
    document.getElementById('f').addEventListener('submit', async e => {
      e.preventDefault();
      const pw = document.getElementById('pw').value;
      const r = await fetch(location.pathname + '?password=' + encodeURIComponent(pw), { redirect: 'manual' });
      if (r.type === 'opaqueredirect' || r.status === 0 || r.ok) {
        location.href = location.pathname + '?password=' + encodeURIComponent(pw);
      } else {
        document.getElementById('err').classList.add('show');
        document.getElementById('pw').value = '';
        document.getElementById('pw').focus();
      }
    });
  </script>
</body>
</html>`;
}

module.exports = ShortenGet;

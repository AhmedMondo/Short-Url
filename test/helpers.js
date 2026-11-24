const { createApp } = require("../src/app");
const { loadConfig } = require("../src/config");

/** In-memory stand-in for the mysql2 pool: only the queries the app issues. */
function fakePool() {
  const rows = [];
  let id = 1;
  const pool = {
    rows,
    failing: false,
    async query(sql, params = []) {
      if (pool.failing) throw Object.assign(new Error("db down"), { code: "ECONNREFUSED" });
      if (/^SELECT 1$/i.test(sql)) return [[{ 1: 1 }]];
      if (/^SELECT id FROM/i.test(sql)) return [rows.filter((r) => r.code === params[0])];
      if (/^SELECT url, expires_at, password_hash/i.test(sql)) return [rows.filter((r) => r.code === params[0]).slice(0, 1)];
      if (/^INSERT INTO short_links/i.test(sql)) {
        if (rows.some((r) => r.code === params[0])) throw Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" });
        rows.push({ id: id++, code: params[0], url: params[1], password_hash: params[2], expires_at: params[3], clicks: 0 });
        return [{ affectedRows: 1 }];
      }
      if (/^UPDATE short_links SET clicks/i.test(sql)) {
        const r = rows.find((x) => x.code === params[0]);
        if (r) r.clicks++;
        return [{ affectedRows: r ? 1 : 0 }];
      }
      throw new Error("fakePool: unexpected query " + sql);
    },
  };
  return pool;
}

const baseEnv = {
  DB_HOST: "x", DB_USER: "x", DB_PASSWORD: "x", DB_NAME: "x",
  SHORT_DOMAIN: "https://go.example.com",
};

async function start(envOverrides = {}) {
  const pool = fakePool();
  const config = loadConfig({ ...baseEnv, ...envOverrides });
  const origError = console.error;
  const app = createApp({ pool, config, log: () => {} });
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { pool, base, close: () => new Promise((r) => server.close(r)), origError };
}

const post = (base, path, body, headers = {}) =>
  fetch(base + path, { method: "POST", redirect: "manual", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

module.exports = { start, post };

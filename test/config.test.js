const test = require("node:test");
const assert = require("node:assert");
const { loadConfig } = require("../src/config");

const ok = { DB_HOST: "h", DB_USER: "u", DB_PASSWORD: "p", DB_NAME: "n", SHORT_DOMAIN: "https://go.example.com/" };

test("valid config, trailing slash trimmed", () => {
  const c = loadConfig(ok);
  assert.strictEqual(c.shortDomain, "https://go.example.com");
  assert.strictEqual(c.port, 3000);
});

test("reports every problem at once", () => {
  assert.throws(() => loadConfig({ PORT: "abc", DB_PASSWORD: "your_password_here", NODE_ENV: "production" }), (e) =>
    /PORT/.test(e.message) && /DB_HOST/.test(e.message) && /placeholder/.test(e.message) && /SHORT_DOMAIN/.test(e.message));
});

test("short API_KEY rejected; missing SHORT_DOMAIN falls back outside production", () => {
  assert.throws(() => loadConfig({ ...ok, API_KEY: "short" }), /API_KEY/);
  const c = loadConfig({ ...ok, SHORT_DOMAIN: undefined });
  assert.strictEqual(c.shortDomain, "http://localhost:3000");
  assert.ok(c.warnings.length >= 1);
});

const test = require("node:test");
const assert = require("node:assert");
const { start, post } = require("./helpers");

test("health: ok, and 503 when the database is down", async () => {
  const s = await start();
  assert.strictEqual((await fetch(s.base + "/health")).status, 200);
  s.pool.failing = true;
  const quiet = console.error; console.error = () => {};
  assert.strictEqual((await fetch(s.base + "/health")).status, 503);
  console.error = quiet;
  await s.close();
});

test("create then resolve at the ROOT path (matches the returned URL)", async () => {
  const s = await start();
  const r = await post(s.base, "/shorten", { url: "https://example.com/a", code: "my-link" });
  assert.strictEqual(r.status, 200);
  const j = await r.json();
  assert.strictEqual(j.url, "https://go.example.com/my-link");
  for (const path of ["/my-link", "/short/my-link"]) {
    const g = await fetch(s.base + path, { redirect: "manual" });
    assert.strictEqual(g.status, 302, path);
    assert.strictEqual(g.headers.get("location"), "https://example.com/a");
  }
  assert.strictEqual(s.pool.rows[0].clicks, 2);
  await s.close();
});

test("random code is generated, duplicate custom code is 409", async () => {
  const s = await start();
  const j = await (await post(s.base, "/shorten", { url: "https://example.com" })).json();
  assert.match(j.code, /^[A-Za-z0-9]{7}$/);
  await post(s.base, "/shorten", { url: "https://example.com", code: "taken" });
  assert.strictEqual((await post(s.base, "/shorten", { url: "https://example.com", code: "taken" })).status, 409);
  await s.close();
});

test("validation: bad url, scheme, reserved code, bad code, bad/past expiry, long password, bad JSON", async () => {
  const s = await start();
  const cases = [
    { url: "nope" },
    { url: "javascript:alert(1)" },
    { url: ["https://a.com"] },
    { url: "https://a.com", code: "health" },
    { url: "https://a.com", code: "has space" },
    { url: "https://a.com", code: "x".repeat(65) },
    { url: "https://a.com", expiresAt: "2020-01-01" },
    { url: "https://a.com", expiresAt: "2999-02-31" },
    { url: "https://a.com", expiresAt: "tomorrow" },
    { url: "https://a.com", password: "p".repeat(73) },
    { url: "https://a.com", password: 12345 },
  ];
  for (const c of cases) assert.strictEqual((await post(s.base, "/shorten", c)).status, 400, JSON.stringify(c));
  const bad = await fetch(s.base + "/shorten", { method: "POST", headers: { "content-type": "application/json" }, body: "{oops" });
  assert.strictEqual(bad.status, 400);
  assert.strictEqual(s.pool.rows.length, 0);
  await s.close();
});

test("expired and unknown links are 404, malformed code is 400", async () => {
  const s = await start();
  s.pool.rows.push({ code: "old", url: "https://a.com", password_hash: null, expires_at: new Date(Date.now() - 1000) });
  assert.strictEqual((await fetch(s.base + "/old", { redirect: "manual" })).status, 404);
  assert.strictEqual((await fetch(s.base + "/missing", { redirect: "manual" })).status, 404);
  assert.strictEqual((await fetch(s.base + "/bad%20code", { redirect: "manual" })).status, 400);
  await s.close();
});

test("password links: GET shows form, query password is ignored, POST unlocks", async () => {
  const s = await start();
  await post(s.base, "/shorten", { url: "https://example.com/secret", code: "pw", password: "hunter22" });
  assert.notStrictEqual(s.pool.rows[0].password_hash, "hunter22");

  const viaQuery = await fetch(s.base + "/pw?password=hunter22", { redirect: "manual" });
  assert.strictEqual(viaQuery.status, 200);
  assert.match(await viaQuery.text(), /<form method="POST" action="\/pw">/);
  assert.strictEqual(s.pool.rows[0].clicks, 0);

  const wrong = await post(s.base, "/pw", { password: "nope" });
  assert.strictEqual(wrong.status, 401);
  const form = await fetch(s.base + "/pw", { method: "POST", redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" }, body: "password=hunter22" });
  assert.strictEqual(form.status, 303);
  assert.strictEqual(form.headers.get("location"), "https://example.com/secret");
  assert.strictEqual(s.pool.rows[0].clicks, 1);
  await s.close();
});

test("built-in form includes an optional API key and sends it only when filled", async () => {
  const s = await start();
  const html = await (await fetch(s.base + "/")).text();
  assert.match(html, /<input type="password" id="apiKey"/);
  assert.match(html, /if \(apiKey\) headers\['x-api-key'\] = apiKey;/);
  await s.close();
});

test("API key: required on create when configured, never on resolve", async () => {
  const key = "k".repeat(20);
  const s = await start({ API_KEY: key });
  assert.strictEqual((await post(s.base, "/shorten", { url: "https://a.com", code: "ak" })).status, 401);
  assert.strictEqual((await post(s.base, "/shorten", { url: "https://a.com", code: "ak" }, { "x-api-key": "wrong" + key })).status, 401);
  assert.strictEqual((await post(s.base, "/shorten", { url: "https://a.com", code: "ak" }, { "x-api-key": key })).status, 200);
  assert.strictEqual((await post(s.base, "/shorten", { url: "https://a.com", code: "ak2" }, { authorization: `Bearer ${key}` })).status, 200);
  assert.strictEqual((await fetch(s.base + "/ak", { redirect: "manual" })).status, 302);
  await s.close();
});

test("rate limit on create returns 429", async () => {
  const s = await start({ RATE_LIMIT_CREATE_PER_MIN: "3" });
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await post(s.base, "/shorten", { url: "https://a.com" })).status);
  assert.deepStrictEqual(codes, [200, 200, 200, 429, 429]);
  await s.close();
});

test("unexpected DB error gives a JSON 500 without leaking details", async () => {
  const s = await start();
  s.pool.failing = true;
  const quiet = console.error; console.error = () => {};
  const r = await post(s.base, "/shorten", { url: "https://a.com" });
  console.error = quiet;
  assert.strictEqual(r.status, 500);
  assert.deepStrictEqual(await r.json(), { error: "Internal server error" });
  await s.close();
});

<div align="center">

# 🔗 Short-URL

**A fast, free, open-source URL shortener.**  
Password protection · Expiry dates · Custom codes · Click tracking

**Live demo → [go.lous.in](https://go.lous.in)**

[![MIT License](https://img.shields.io/badge/license-MIT-c8ff00?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-c8ff00?style=flat-square&logo=node.js&logoColor=black)](https://nodejs.org)
[![Express](https://img.shields.io/badge/express-4.x-c8ff00?style=flat-square)](https://expressjs.com)
[![MySQL](https://img.shields.io/badge/mysql-8%2B-c8ff00?style=flat-square&logo=mysql&logoColor=black)](https://www.mysql.com)

</div>

---

## Overview

**Short-URL** is the open-source backend (and frontend) powering [go.lous.in](https://go.lous.in).  
It was originally built as part of the **Lousin API** monorepo and has been extracted here as a clean, self-contained project that anyone can clone, configure, and deploy.

**What it does:**

- Shorten any `http://` or `https://` URL to a 7-character alphanumeric code
- Optionally protect links with a **bcrypt-hashed password**
- Set an optional **expiry date** — links auto-404 after the date passes
- Use a **custom slug** instead of a random code (e.g. `go.lous.in/my-link`)
- Track **click counts** and `last_clicked_at` timestamps automatically
- Ships with a polished **single-file frontend** (`public/index.html`) and a built-in **API reference page**

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Configuration](#configuration)
4. [Database Setup](#database-setup)
5. [API Reference](#api-reference)
6. [How It Works](#how-it-works)
7. [Self-Hosting & Deployment](#self-hosting--deployment)
8. [Contributing](#contributing)
9. [License](#license)

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/AhmedMondo/Short-Url.git
cd Short-Url

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# → edit .env with your database credentials and desired port

# 4. Create the database table
mysql -u root -p your_database < schema.sql

# 5. Start
npm start
# → http://localhost:3000
```

> **Need hot-reload during development?**  
> `npm run dev` uses `nodemon` to restart on file changes.

---

## Project Structure

```
short-url/
│
├── src/
│   ├── index.js              # App entry point — Express setup, DB pool, route loader
│   ├── structures/
│   │   └── Route.js          # Base Route class (all routes extend this)
│   ├── routes/
│   │   ├── shorten.js        # POST /shorten — create a short link
│   │   ├── shortenGet.js     # GET  /short/:code — resolve & redirect
│   │   └── shortenPost.js    # POST /short/:code — password-form submission
│   └── utils/
│       └── Shortener.js      # isValidHttpUrl() + generateUniqueCode()
│
├── public/
│   └── index.html            # Frontend UI + API docs (single self-contained file)
│
├── schema.sql                # MySQL table definition — run once to set up the DB
├── .env.example              # Environment variable template
├── package.json
└── README.md
```

### How routes are loaded

`src/app.js` scans every `.js` file in `src/routes/` at startup and registers each one on Express automatically. To add a new endpoint, just drop a file that exports a class extending `Route` — no registration boilerplate needed.

---

## Configuration

Copy `.env.example` to `.env` and fill in your values:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `NODE_ENV` | — | Set `production` when deployed; makes `SHORT_DOMAIN` mandatory |
| `DB_HOST` | required | MySQL hostname |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | required | MySQL username |
| `DB_PASSWORD` | required | MySQL password (the `.env.example` placeholder is rejected) |
| `DB_NAME` | required | Database name (must already exist) |
| `SHORT_DOMAIN` | required in production | Public domain used in API responses, e.g. `https://go.example.com` |
| `API_KEY` | empty | If set (16+ chars), `POST /shorten` requires it. Empty = open creation, with a startup warning |
| `TRUST_PROXY` | empty | Number of reverse proxies in front (e.g. `1`), so rate limits use real client IPs |
| `RATE_LIMIT_CREATE_PER_MIN` | `20` | Link creations per IP per minute |
| `RATE_LIMIT_UNLOCK_PER_MIN` | `10` | Password attempts per IP per minute |

The server validates all of this at startup and exits with a list of problems instead of failing on the first request.

---

## Database Setup

Create the (empty) database, then run the migrations:

```bash
npm run migrate
```

This applies `migrations/*.sql` in order, once each, and is safe to run on every deploy. `schema.sql` is kept for anyone who prefers to apply the table by hand. See [docs/SETUP.md](docs/SETUP.md) for install, backup and restore.

---

## API Reference

Base URL: `https://api.lous.in` (live) or `http://localhost:3000` (local)

---

### `POST /shorten` — Create a short link

**Content-Type:** `application/json`

#### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string | ✅ | Destination URL. Must start with `http://` or `https://`, max 8000 chars. |
| `password` | string | optional | Plain-text password, max 72 chars. Stored as a bcrypt hash (12 rounds). |
| `expiresAt` | string | optional | Future date in strict `YYYY-MM-DD` format (UTC). Link returns 404 after this date. |
| `code` | string | optional | Custom slug, 1-64 chars of `A-Za-z0-9_-` (e.g. `my-link`). `409` if taken, `400` if reserved (`health`, `shorten`, `short`). |

If `API_KEY` is set, add the header `x-api-key: <key>` (or `Authorization: Bearer <key>`).

#### Example request

```bash
curl -X POST https://go.example.com/shorten \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "url": "https://example.com/some/very/long/path",
    "password": "secret123",
    "expiresAt": "2030-12-31",
    "code": "my-link"
  }'
```

#### Success response `200`

```json
{
  "code": "my-link",
  "url": "https://go.example.com/my-link",
  "password_protected": true,
  "expires_at": "2025-12-31T00:00:00.000Z"
}
```

#### Error responses

| Status | Body | Cause |
|---|---|---|
| `400` | `{ "error": "..." }` | Invalid url, expiresAt (format or past), password, or code |
| `401` | `{ "error": "Unauthorized..." }` | `API_KEY` is set and the header is missing or wrong |
| `429` | `{ "error": "Too many requests..." }` | Rate limit hit |
| `409` | `{ "error": "Code already taken" }` | Custom code conflict |
| `500` | `{ "error": "Internal server error" }` | Database error |

---

### `GET /:code` (also `GET /short/:code`) — Resolve & redirect

Short URLs returned by `POST /shorten` look like `https://go.example.com/<code>`, so the root path `/<code>` resolves them. `/short/<code>` still works for existing integrations.

Redirects `302` to the destination URL. Increments `clicks` and sets `last_clicked_at` on every successful visit.

If the link is **password-protected**, an HTML unlock form is served instead. Passwords are **not** accepted in the query string (they would end up in logs and browser history).

```
GET https://go.example.com/my-link
→ 302  Location: https://example.com/some/very/long/path

GET https://go.example.com/unknown
→ 404  "Not Found"
```

Codes must match `^[a-zA-Z0-9_-]{1,64}$`. Anything else returns `400`.

---

### `POST /:code` (also `POST /short/:code`) — Password form submission

**Body** (`application/x-www-form-urlencoded` or JSON): `password`

On success → `303` redirect to the destination URL.  
On failure → `401` and the form again. Limited to `RATE_LIMIT_UNLOCK_PER_MIN` attempts per IP.

---

### `GET /health`

`200 {"status":"ok"}` when the app can reach the database, `503` otherwise. Use it for uptime monitors.

---

### Code examples

**JavaScript / Node.js**

```js
const res = await fetch('https://go.example.com/shorten', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://example.com/long-url',
    code: 'my-link',       // optional
    expiresAt: '2025-12-31' // optional
  })
});

const data = await res.json();
console.log(data.url); // https://go.example.com/my-link
```

**Python**

```python
import requests

data = requests.post('https://go.example.com/shorten', json={
    'url': 'https://example.com/long-url',
    'code': 'my-link',
}).json()

print(data['url'])  # https://go.example.com/my-link
```

**cURL**

```bash
curl -X POST https://go.example.com/shorten \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/long-url","code":"my-link"}'
```

---

## How It Works

### Code generation

Random codes are generated with [nanoid](https://github.com/ai/nanoid) using a 62-character alphanumeric alphabet and a length of 7. That gives **62⁷ ≈ 3.5 trillion** possible combinations. `generateUniqueCode()` retries up to 5 times before throwing if a collision is found (statistically near-impossible in practice).

### Password security

Passwords are **never stored in plain text**. When a password is provided on creation, it is hashed with **bcrypt at 12 salt rounds** and only the hash is saved. On resolution, `bcrypt.compare()` is used — the original password is never recoverable from the database.

### Expiry

`expires_at` is stored as a `DATETIME`. Every time a link is resolved, the server compares `expires_at` against `new Date()`. Expired links return `404 Not Found` exactly like missing links (no information leak).

### Click tracking

On every successful redirect (after password verification if applicable), the server runs:

```sql
UPDATE short_links
SET clicks = clicks + 1, last_clicked_at = NOW()
WHERE code = ?
```

---

## Self-Hosting & Deployment

### Requirements

- **Node.js** ≥ 20 (22 recommended, see `.nvmrc`)
- **MySQL** 5.7+ or **MariaDB** 10.3+

### With PM2 (production)

```bash
npm install -g pm2
pm2 start src/index.js --name short-url
pm2 save
pm2 startup
```

### With Docker Compose (app + MySQL)

```bash
cp .env.example .env     # set DB_PASSWORD, API_KEY, SHORT_DOMAIN
docker compose up -d --build
curl http://localhost:3000/health
```

The compose file starts MySQL, waits for it to be healthy, runs the migrations, then starts the app. Data lives in the `db_data` volume.

### Reverse proxy (nginx example)

```nginx
server {
    listen 80;
    server_name go.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Then add SSL with `certbot --nginx`, and set `TRUST_PROXY=1` in `.env`.

---

## Contributing

Contributions are welcome! Feel free to open issues or pull requests.

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push and open a PR

---

## Tests

```bash
npm test
```

The suite uses Node's built-in test runner and an in-memory stand-in for the database, so it needs no MySQL.

---

## License

[MIT](LICENSE) — built with ❤ by [Ahmed_Mondo (Lousin)](https://lous.in)

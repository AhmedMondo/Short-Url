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

`src/index.js` scans every `.js` file in `src/routes/` at startup and registers each one on Express automatically. To add a new endpoint, just drop a file that exports a class extending `Route` — no registration boilerplate needed.

---

## Configuration

Copy `.env.example` to `.env` and fill in your values:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `DB_HOST` | `localhost` | MySQL hostname |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL username |
| `DB_PASSWORD` | — | MySQL password |
| `DB_NAME` | `shorturl` | Database name |
| `SHORT_DOMAIN` | `https://go.lous.in` | Public domain used in API responses |

---

## Database Setup

Run the included `schema.sql` once to create the table:

```bash
mysql -u root -p your_database_name < schema.sql
```

Or paste it manually in any MySQL client. The schema creates:

```sql
CREATE TABLE short_links (
  id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  code            VARCHAR(64)      NOT NULL,          -- short code / slug
  url             TEXT             NOT NULL,          -- destination URL
  password_hash   VARCHAR(255)     DEFAULT NULL,      -- bcrypt hash (NULL = no password)
  expires_at      DATETIME         DEFAULT NULL,      -- optional expiry
  clicks          BIGINT UNSIGNED  NOT NULL DEFAULT 0,
  last_clicked_at DATETIME         DEFAULT NULL,
  created_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_code (code)
);
```

---

## API Reference

Base URL: `https://api.lous.in` (live) or `http://localhost:3000` (local)

---

### `POST /shorten` — Create a short link

**Content-Type:** `application/json`

#### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string | ✅ | Destination URL. Must start with `http://` or `https://`. |
| `password` | string | optional | Plain-text password. Stored as a bcrypt hash (12 rounds). |
| `expiresAt` | string | optional | Expiry date in `YYYY-MM-DD` format. Link returns 404 after this date. |
| `code` | string | optional | Custom short slug (e.g. `my-link`). Returns `409` if already taken. |

#### Example request

```bash
curl -X POST https://api.lous.in/shorten \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/some/very/long/path",
    "password": "secret123",
    "expiresAt": "2025-12-31",
    "code": "my-link"
  }'
```

#### Success response `200`

```json
{
  "code": "my-link",
  "url": "https://go.lous.in/my-link",
  "password_protected": true,
  "expires_at": "2025-12-31T00:00:00.000Z"
}
```

#### Error responses

| Status | Body | Cause |
|---|---|---|
| `400` | `{ "error": "Usage", ... }` | Missing or invalid URL |
| `400` | `{ "error": "expiresAt must be a valid date..." }` | Invalid date format |
| `409` | `{ "error": "Code already taken" }` | Custom code conflict |
| `500` | `{ "error": "Internal server error" }` | Database error |

---

### `GET /short/:code` — Resolve & redirect

Redirects `302` to the destination URL. Increments `clicks` and sets `last_clicked_at` on every successful visit.

If the link is **password-protected** and no `?password=` query param is present, serves an HTML unlock page instead.

```
GET https://api.lous.in/short/my-link
→ 302  Location: https://example.com/some/very/long/path

GET https://api.lous.in/short/my-link?password=secret123
→ 302  Location: https://example.com/some/very/long/path  (if correct)
→ 401  "Invalid password"                                  (if wrong)

GET https://api.lous.in/short/unknown
→ 404  "Not Found"
```

#### Code validation

Codes must match `^[a-zA-Z0-9_-]+$`. Any other characters return `400 Bad request`.

---

### `POST /short/:code` — Password form submission

Handles the form `POST` from the built-in HTML password-gate page.

**Body** (`application/x-www-form-urlencoded`):

| Field | Description |
|---|---|
| `password` | Plain-text password to verify |

On success → `302` redirect to the destination URL.  
On failure → `401 Invalid password`.

---

### Code examples

**JavaScript / Node.js**

```js
const res = await fetch('https://api.lous.in/shorten', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://example.com/long-url',
    code: 'my-link',       // optional
    expiresAt: '2025-12-31' // optional
  })
});

const data = await res.json();
console.log(data.url); // https://go.lous.in/my-link
```

**Python**

```python
import requests

data = requests.post('https://api.lous.in/shorten', json={
    'url': 'https://example.com/long-url',
    'code': 'my-link',
}).json()

print(data['url'])  # https://go.lous.in/my-link
```

**cURL**

```bash
curl -X POST https://api.lous.in/shorten \
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

- **Node.js** ≥ 18
- **MySQL** 5.7+ or **MariaDB** 10.3+

### With PM2 (production)

```bash
npm install -g pm2
pm2 start src/index.js --name short-url
pm2 save
pm2 startup
```

### With Docker (bring your own DB)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

```bash
docker build -t short-url .
docker run -d --env-file .env -p 3000:3000 short-url
```

### Reverse proxy (nginx example)

```nginx
server {
    listen 80;
    server_name go.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then add SSL with `certbot --nginx`.

---

## Contributing

Contributions are welcome! Feel free to open issues or pull requests.

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push and open a PR

---

## License

[MIT](LICENSE) — built with ❤ by [Ahmed_Mondo (Lousin)](https://lous.in)

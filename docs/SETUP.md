# Setup, backup and restore

## 1. Fresh install (no Docker)

Needs Node.js 20+ and MySQL 5.7+ / MariaDB 10.3+.

```bash
git clone <this repo> && cd Short-Url
npm ci
cp .env.example .env            # edit DB_*, SHORT_DOMAIN, API_KEY
mysql -u root -p -e "CREATE DATABASE shorturl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
npm run migrate
npm test                        # no database needed
npm start
curl http://localhost:3000/health
```

If `.env` is wrong the app prints every problem and exits. If the database is unreachable or not migrated, it says so and exits.

## 2. Docker Compose

```bash
cp .env.example .env            # set DB_PASSWORD, API_KEY, SHORT_DOMAIN
docker compose up -d --build
docker compose logs -f app
```

## 3. Try it

```bash
# create
curl -s -X POST http://localhost:3000/shorten \
  -H "Content-Type: application/json" -H "x-api-key: $API_KEY" \
  -d '{"url":"https://example.com","code":"demo"}'

# follow
curl -i http://localhost:3000/demo

# password-protected link: opens a form, password is sent by POST
curl -s -X POST http://localhost:3000/shorten -H "Content-Type: application/json" -H "x-api-key: $API_KEY" \
  -d '{"url":"https://example.com","code":"vip","password":"s3cret-pass"}'
curl -i -X POST http://localhost:3000/vip -d 'password=s3cret-pass'
```

## 4. Backup

```bash
# plain install
mysqldump -u root -p --single-transaction shorturl > shorturl-$(date +%F).sql

# docker compose
docker compose exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction "$MYSQL_DATABASE"' > shorturl-$(date +%F).sql
```

Run it from cron daily and copy the file off the server.

## 5. Restore

```bash
# plain install
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS shorturl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p shorturl < shorturl-2026-01-01.sql

# docker compose
docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < shorturl-2026-01-01.sql
```

The dump includes `schema_migrations`, so `npm run migrate` afterwards does nothing unless there are newer migrations.

## 6. Production checklist

- `NODE_ENV=production`, real `SHORT_DOMAIN`, strong `DB_PASSWORD`.
- Set `API_KEY` unless you want anyone to create links.
- Behind nginx/Caddy with HTTPS; set `TRUST_PROXY=1`.
- Point an uptime monitor at `/health`.
- Schedule the backup above.

/**
 * Applies migrations/*.sql in filename order, once each (tracked in the
 * schema_migrations table). Safe to run on every deploy.
 * Needs the same DB_* variables as the app; the database itself must exist.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function main() {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME || DB_PASSWORD === undefined) {
    console.error("DB_HOST, DB_USER, DB_PASSWORD and DB_NAME must be set");
    process.exit(1);
  }

  // The DB may still be starting (e.g. docker compose): retry for up to ~60s.
  let conn;
  for (let i = 0; i < 30; i++) {
    try {
      conn = await mysql.createConnection({
        host: DB_HOST, port: Number(DB_PORT) || 3306, user: DB_USER,
        password: DB_PASSWORD, database: DB_NAME, multipleStatements: true,
      });
      break;
    } catch (err) {
      if (i === 29) { console.error("Cannot connect to the database:", err.message); process.exit(1); }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  await conn.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) NOT NULL PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)"
  );
  const [done] = await conn.query("SELECT name FROM schema_migrations");
  const applied = new Set(done.map((r) => r.name));

  const dir = path.join(__dirname, "../migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    console.log(`applying ${file}`);
    await conn.query(fs.readFileSync(path.join(dir, file), "utf8"));
    await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
  }
  console.log("migrations up to date");
  await conn.end();
}

main().catch((err) => { console.error(err); process.exit(1); });

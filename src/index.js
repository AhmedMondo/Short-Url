require("dotenv").config();
const mysql = require("mysql2/promise");
const { loadConfig } = require("./config");
const { createApp } = require("./app");

async function main() {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  config.warnings.forEach((w) => console.warn(`WARNING: ${w}`));

  const pool = mysql.createPool({ ...config.db, waitForConnections: true, connectionLimit: 10 });

  try {
    await pool.query("SELECT 1 FROM short_links LIMIT 1");
  } catch (err) {
    console.error(`Database check failed (${err.code || err.message}). Is MySQL reachable and migrated? Run: npm run migrate`);
    process.exit(1);
  }

  const app = createApp({ pool, config });
  const server = app.listen(config.port, () => {
    console.log(`\nShort-URL running -> http://localhost:${config.port}\n`);
  });

  const shutdown = () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();

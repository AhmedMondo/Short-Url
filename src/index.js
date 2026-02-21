require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ──────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // needed for HTML password form POST
app.use(express.static(path.join(__dirname, "../public")));

// ──────────────────────────────────────────
// Database pool
// ──────────────────────────────────────────
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "shorturl",
  waitForConnections: true,
  connectionLimit: 10,
});

// Attach pool to app so routes can access it via req.app.pool
app.pool = pool;

// ──────────────────────────────────────────
// Auto-load routes from src/routes/
// ──────────────────────────────────────────
const routesDir = path.join(__dirname, "routes");

fs.readdirSync(routesDir)
  .filter((f) => f.endsWith(".js"))
  .forEach((file) => {
    const RouteClass = require(path.join(routesDir, file));
    const route = new RouteClass(app);
    const method = route.method.toLowerCase(); // 'get' | 'post'
    const name = route.name; // e.g. 'shorten' or 'short/:code'

    app[method](`/${name}`, (req, res) => route.RouteRun(req, res));
    console.log(`  ✓  [${route.method.toUpperCase()}] /${name}`);
  });

// ──────────────────────────────────────────
// Serve frontend for everything else
// ──────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ──────────────────────────────────────────
// Start
// ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🔗  Short-URL running → http://localhost:${PORT}\n`);
});

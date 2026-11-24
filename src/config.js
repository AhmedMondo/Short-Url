/**
 * Reads and validates configuration from an env-like object.
 * Throws one Error listing every problem, so a bad deployment fails at
 * startup with a clear message instead of at the first request.
 */
function loadConfig(env = process.env) {
  const errors = [];
  const warnings = [];
  const isProd = env.NODE_ENV === "production";

  const port = env.PORT === undefined || env.PORT === "" ? 3000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push("PORT must be an integer between 1 and 65535");
  }

  const dbPort = env.DB_PORT ? Number(env.DB_PORT) : 3306;
  if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
    errors.push("DB_PORT must be an integer between 1 and 65535");
  }

  for (const key of ["DB_HOST", "DB_USER", "DB_NAME"]) {
    if (!env[key]) errors.push(`${key} is required`);
  }
  if (env.DB_PASSWORD === undefined) {
    errors.push("DB_PASSWORD is required (set it to an empty value only for a local test database)");
  } else if (env.DB_PASSWORD === "your_password_here") {
    errors.push("DB_PASSWORD is still the placeholder from .env.example");
  }

  let shortDomain = env.SHORT_DOMAIN;
  if (!shortDomain) {
    if (isProd) {
      errors.push("SHORT_DOMAIN is required when NODE_ENV=production (e.g. https://go.example.com)");
    } else {
      shortDomain = `http://localhost:${port}`;
      warnings.push(`SHORT_DOMAIN not set, using ${shortDomain}`);
    }
  }
  if (shortDomain) {
    try {
      const u = new URL(shortDomain);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("protocol");
      shortDomain = shortDomain.replace(/\/+$/, "");
    } catch {
      errors.push("SHORT_DOMAIN must be a full http(s) URL such as https://go.example.com");
    }
  }

  const apiKey = env.API_KEY || "";
  if (apiKey && apiKey.length < 16) {
    errors.push("API_KEY must be at least 16 characters when set");
  }
  if (!apiKey) {
    warnings.push("API_KEY is not set: anyone who can reach POST /shorten can create links");
  }

  const num = (key, def) => {
    const v = env[key] === undefined || env[key] === "" ? def : Number(env[key]);
    if (!Number.isInteger(v) || v < 1) {
      errors.push(`${key} must be a positive integer`);
      return def;
    }
    return v;
  };

  const trustProxy = env.TRUST_PROXY === undefined || env.TRUST_PROXY === ""
    ? false
    : /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY)
    : env.TRUST_PROXY === "true" ? true : env.TRUST_PROXY === "false" ? false : env.TRUST_PROXY;

  if (errors.length) {
    throw new Error("Invalid configuration:\n  - " + errors.join("\n  - "));
  }

  return {
    port,
    shortDomain,
    apiKey,
    trustProxy,
    rateLimitCreatePerMin: num("RATE_LIMIT_CREATE_PER_MIN", 20),
    rateLimitUnlockPerMin: num("RATE_LIMIT_UNLOCK_PER_MIN", 10),
    db: {
      host: env.DB_HOST,
      port: dbPort,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    },
    warnings,
  };
}

module.exports = { loadConfig };

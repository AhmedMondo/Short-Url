const ShortenGet = require("./shortenGet");

/**
 * GET /:code - the path that the generated short URLs (SHORT_DOMAIN/<code>)
 * actually point to. Registered last so it never shadows /health or /shorten.
 */
class ResolveRoot extends ShortenGet {
  constructor(app) {
    super(app, { name: ":code", usage: "GET /:code", last: true });
  }
}

module.exports = ResolveRoot;

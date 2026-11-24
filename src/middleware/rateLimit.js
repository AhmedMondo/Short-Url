const rateLimit = require("express-rate-limit");

function limiter(max, message) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });
}

module.exports = { limiter };

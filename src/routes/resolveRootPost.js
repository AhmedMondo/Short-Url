const ShortenPost = require("./shortenPost");

/** POST /:code - password form submission for links opened at the root path. */
class ResolveRootPost extends ShortenPost {
  constructor(app) {
    super(app, { name: ":code", usage: "POST /:code", last: true });
  }
}

module.exports = ResolveRootPost;

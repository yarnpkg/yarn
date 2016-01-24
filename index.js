if (require("semver").satisfies(process.versions.node, ">5.0.0")) {
  module.exports = require("./lib/api.js");
} else {
  module.exports = require("./lib-legacy/api.js");
}

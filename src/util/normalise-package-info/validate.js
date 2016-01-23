/* @flow */

import typos from "./typos";

let semver = require("semver");

export default function (info: Object, moduleLoc: string, warn: ?Function): void {
  for (let typoKey in typos) {
    if (typoKey in info) {
      // TODO: warn or something
    }
  }

  let name = info.name;
  if (typeof name === "string") {
    // cannot start with a dot
    if (name[0] === ".") {
      throw new TypeError;
    }

    // cannot contain the following characters
    if (name.match(/[\/@\s\+%:]/)) {
      throw new TypeError;
    }

    // cannot contain any characters that would need to be encoded for use in a url
    if (name !== encodeURIComponent(name)) {
      throw new TypeError;
    }

    // cannot equal node_modules or favicon.ico
    let lower = name.toLowerCase();
    if (lower === "node_modules" || lower === "favico.ico") {
      throw new TypeError;
    }
  }

  // validate semver version
  if (typeof info.version === "string" && !semver.valid(info.version)) {
    info.version = semver.clean(info.version);
  }
}

#!/usr/bin/env node

if (require("semver").satisfies(process.versions.node, ">5.0.0")) {
  require("../lib/cli");
} else {
  require("../lib-legacy/cli");
}

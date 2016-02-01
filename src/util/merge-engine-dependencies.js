/* @flow */

import type { PackageInfo } from "../types";

let semver = require("semver");

export default function (info: PackageInfo) {
  let engineDeps = info.engineDependencies;
  if (!engineDeps) return;

  info.dependencies = info.dependencies || {};

  for (let range in engineDeps) {
    if (semver.satisfies(process.version, range)) {
      Object.assign(info.dependencies, engineDeps[range]);
    }
  }
}

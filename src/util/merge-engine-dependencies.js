/* @flow */

import type { PackageInfo } from "../types";

let semver = require("semver");

export default function (info: PackageInfo) {
  let engineDeps = info.engineDependencies;
  if (!engineDeps) return;

  info.dependencies = info.dependencies || {};

  for (let version in engineDeps) {
    if (semver.satisfies(process.version, version)) {
      Object.assign(info.dependencies, engineDeps[version]);
    }
  }
}

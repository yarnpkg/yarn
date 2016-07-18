/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type { Reporter } from "../../reporters/index.js";
import type Config from "../../config.js";
import type { DependencyRequestPatterns } from "../../types.js";
import type PackageResolver from "../../package-resolver.js";
import type { Tree } from "../../reporters/types.js";
import { Install } from "./install.js";
import Lockfile from "../../lockfile/index.js";

export let noArguments = true;

export function buildTree(
  resolver: PackageResolver,
  depRequests: DependencyRequestPatterns,
  onlyFresh?: boolean
) {
  let trees = [];
  let count = 0;

  function build(pattern, hint, ancestry = []): ?Tree {
    if (ancestry.indexOf(pattern) >= 0) return;
    if (onlyFresh && !resolver.isNewPattern(pattern)) return;

    count++;

    let pkg = resolver.getResolvedPattern(pattern);
    let name = `${pkg.name}@${pkg.version}`;
    ancestry.push(pattern);

    let children = [];
    for (let pattern of pkg.reference.dependencies) {
      let tree = build(pattern, null, ancestry.slice());
      if (tree) children.push(tree);
    }

    return { name, children, hint };
  }

  for (let dep of depRequests) {
    let tree = build(dep.pattern, dep.hint);
    if (tree) trees.push(tree);
  }

  return { trees, count };
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>
): Promise<void> {
  let lockfile = await Lockfile.fromDirectory(config.cwd, reporter, {
    silent: true,
    strict: false
  });

  let install = new Install("ls", flags, args, config, reporter, lockfile);
  let [depRequests] = await install.fetchRequestFromCwd();
  await install.resolver.init(depRequests);
  reporter.tree("ls", buildTree(install.resolver, depRequests).trees);
}

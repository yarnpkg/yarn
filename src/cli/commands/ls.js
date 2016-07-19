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
import type PackageResolver from "../../package-resolver.js";
import type PackageLinker from "../../package-linker.js";
import type { Trees } from "../../reporters/types.js";
import { Install } from "./install.js";
import Lockfile from "../../lockfile/index.js";

let invariant = require("invariant");

export let noArguments = true;

function buildCount(trees: ?Trees): number {
  if (!trees || !trees.length) {
    return 0;
  }

  let count = 0;

  for (let tree of trees) {
    if (tree.shadow) continue;

    count++;
    count += buildCount(tree.children);
  }

  return count;
}

export async function buildTree(
  resolver: PackageResolver,
  linker: PackageLinker,
  patterns: Array<string>,
  onlyFresh?: boolean
): Promise<{
  count: number,
  trees: Trees
}> {
  let treesByKey = {};
  let trees = [];
  let hoisted = await linker.initCopyModules(patterns);

  // build initial trees
  for (let [, info] of hoisted) {
    let ref = info.pkg.reference;
    invariant(ref, "expected reference");

    if (onlyFresh) {
      let isFresh = false;
      for (let pattern of ref.patterns) {
        if (resolver.isNewPattern(pattern)) {
          isFresh = true;
          break;
        }
      }
      if (!isFresh) continue;
    }

    let hint = null;
    let color = "bold";

    if (info.hoistedFrom[0] !== info.key) {
      // was hoisted
      color = null;
    }

    let tree = {
      name: `${info.pkg.name}@${info.pkg.version}`,
      children: [],
      hint,
      color
    };
    treesByKey[info.key] = tree;

    // add in dummy children for hoisted dependencies
    invariant(ref, "expected reference");
    for (let pattern of resolver.dedupePatterns(ref.dependencies)) {
      let pkg = resolver.getResolvedPattern(pattern);

      if (!hoisted[`${info.key}#${pkg.name}`]) {
        tree.children.push({
          name: pattern,
          color: "dim",
          shadow: true
        });
      }
    }
  }

  // add children
  for (let [, info] of hoisted) {
    let tree = treesByKey[info.key];
    if (!tree) continue;

    let keyParts = info.key.split("#");
    if (keyParts.length === 1) {
      trees.push(tree);
      continue;
    }

    let parentKey = keyParts.slice(0, -1).join("#");
    let parent = treesByKey[parentKey];
    if (!parent) continue;
    parent.children.push(tree);
  }

  return { trees, count: buildCount(trees) };
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>
): Promise<void> {
  let lockfile = await Lockfile.fromDirectory(config.cwd, reporter, {
    silent: true,
    strictIfPresent: true
  });

  let install = new Install("ls", flags, args, config, reporter, lockfile);
  let [depRequests, patterns] = await install.fetchRequestFromCwd();
  await install.resolver.init(depRequests);

  let { trees } = await buildTree(install.resolver, install.linker, patterns);
  reporter.tree("ls", trees);
}

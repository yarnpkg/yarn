/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import type PackageResolver from '../../package-resolver.js';
import type PackageLinker from '../../package-linker.js';
import type {Trees} from '../../reporters/types.js';
import {Install} from './install.js';
import Lockfile from '../../lockfile/wrapper.js';

const invariant = require('invariant');

export const requireLockfile = true;
export const noArguments = true;

function buildCount(trees: ?Trees): number {
  if (!trees || !trees.length) {
    return 0;
  }

  let count = 0;

  for (const tree of trees) {
    if (tree.shadow) {
      continue;
    }

    count++;
    count += buildCount(tree.children);
  }

  return count;
}

export async function buildTree(
  resolver: PackageResolver,
  linker: PackageLinker,
  patterns: Array<string>,
  onlyFresh?: boolean,
  ignoreHoisted?: boolean,
): Promise<{
  count: number,
  trees: Trees
}> {
  const treesByKey = {};
  const trees = [];
  const hoisted = await linker.getFlatHoistedTree(patterns);

  const hoistedByKey = {};
  for (let [key, info] of hoisted) {
    hoistedByKey[key] = info;
  }

  // build initial trees
  for (let [, info] of hoisted) {
    const ref = info.pkg._reference;
    invariant(ref, 'expected reference');

    if (onlyFresh) {
      let isFresh = false;
      for (const pattern of ref.patterns) {
        if (resolver.isNewPattern(pattern)) {
          isFresh = true;
          break;
        }
      }
      if (!isFresh) {
        continue;
      }
    }

    const hint = null;
    let color = 'bold';

    if (info.originalKey !== info.key) {
      // was hoisted
      color = null;
    }

    const children = [];
    treesByKey[info.key] = {
      name: `${info.pkg.name}@${info.pkg.version}`,
      children,
      hint,
      color,
    };

    // add in dummy children for hoisted dependencies
    invariant(ref, 'expected reference');
    if (!ignoreHoisted) {
      for (const pattern of resolver.dedupePatterns(ref.dependencies)) {
        const pkg = resolver.getStrictResolvedPattern(pattern);

        if (!hoistedByKey[`${info.key}#${pkg.name}`]) {
          children.push({
            name: pattern,
            color: 'dim',
            shadow: true,
          });
        }
      }
    }
  }

  // add children
  for (let [, info] of hoisted) {
    const tree = treesByKey[info.key];
    if (!tree) {
      continue;
    }

    const keyParts = info.key.split('#');
    if (keyParts.length === 1) {
      trees.push(tree);
      continue;
    }

    const parentKey = keyParts.slice(0, -1).join('#');
    const parent = treesByKey[parentKey];
    if (parent) {
      parent.children.push(tree);
    }
  }

  return {trees, count: buildCount(trees)};
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const lockfile = await Lockfile.fromDirectory(config.cwd, reporter);
  const install = new Install(flags, config, reporter, lockfile);
  let [depRequests, patterns] = await install.fetchRequestFromCwd();
  await install.resolver.init(depRequests, install.flags.flat);

  const {trees} = await buildTree(install.resolver, install.linker, patterns);
  reporter.tree('ls', trees);
}

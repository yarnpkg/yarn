/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import type PackageResolver from '../../package-resolver.js';
import type PackageLinker from '../../package-linker.js';
import type {Trees} from '../../reporters/types.js';
import {MessageError} from '../../errors.js';
import {Install} from './install.js';
import Lockfile from '../../lockfile/wrapper.js';

const invariant = require('invariant');

export const requireLockfile = true;

export type LsOptions = {
  reqDepth?: ?number,
};

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
  opts: LsOptions,
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
  for (const [key, info] of hoisted) {
    hoistedByKey[key] = info;
  }

  // build initial trees
  for (const [, info] of hoisted) {
    const ref = info.pkg._reference;
    const hint = null;
    const parent = getParent(info.key, treesByKey);
    const children = [];
    let depth =  0;
    let color = 'bold';
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

    if (info.originalKey !== info.key || opts.reqDepth === 0) {
      // was hoisted
      color = null;
    }
    // check parent to obtain next depth
    if (parent && parent.depth > 0) {
      depth = parent.depth + 1;
    } else {
      depth = 0;
    }

    const topLevel = opts.reqDepth === 0 && !parent;
    const showAll = opts.reqDepth === -1;
    const nextDepthIsValid = (depth + 1 <= Number(opts.reqDepth));

    if (topLevel || nextDepthIsValid || showAll) {
      treesByKey[info.key] = {
        name: `${info.pkg.name}@${info.pkg.version}`,
        children,
        hint,
        color,
        depth,
      };
    }

    // add in dummy children for hoisted dependencies
    const nextChildDepthIsValid = (depth + 1 < Number(opts.reqDepth));
    invariant(ref, 'expected reference');
    if ((!ignoreHoisted && nextDepthIsValid) || showAll) {
      for (const pattern of resolver.dedupePatterns(ref.dependencies)) {
        const pkg = resolver.getStrictResolvedPattern(pattern);

        if (!hoistedByKey[`${info.key}#${pkg.name}`] && (nextChildDepthIsValid || showAll)) {
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
  for (const [, info] of hoisted) {
    const tree = treesByKey[info.key];
    const parent = getParent(info.key, treesByKey);
    if (!tree) {
      continue;
    }

    if (info.key.split('#').length === 1) {
      trees.push(tree);
      continue;
    }

    if (parent) {
      parent.children.push(tree);
    }
  }

  return {trees, count: buildCount(trees)};
}

export function getParent(key: string, treesByKey: Object) : Object {
  const parentKey = key.split('#').slice(0, -1).join('#');
  return treesByKey[parentKey];
}

export function setFlags(commander: Object) {
  commander.option('--depth [depth]', 'Limit the depth of the shown dependencies');
}

export function getReqDepth(inputDepth: string) : number {
  return inputDepth && /^\d+$/.test(inputDepth) ?  Number(inputDepth) : -1;
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {

  const lockfile = await Lockfile.fromDirectory(config.cwd, reporter);
  const install = new Install(flags, config, reporter, lockfile);
  const [depRequests, patterns] = await install.fetchRequestFromCwd();
  await install.resolver.init(depRequests, install.flags.flat);

  const opts: LsOptions = {
    reqDepth: getReqDepth(flags.depth),
  };

  let filteredPatterns: Array<string> = [];

  if (args.length) {
    const matchedArgs: Array<string> = [];

    for (const pattern of patterns) {
      const pkg = install.resolver.getStrictResolvedPattern(pattern);

      // ignore patterns if their package names have been specified in arguments
      if (args.indexOf(pkg.name) >= 0) {
        matchedArgs.push(pkg.name);
        filteredPatterns.push(pattern);
      }
    }

    // throw an error if any package names were passed to filter that don't exist
    for (const arg of args) {
      if (matchedArgs.indexOf(arg) < 0) {
        throw new MessageError(reporter.lang('unknownPackage', arg));
      }
    }
  } else {
    filteredPatterns = patterns;
  }

  const {trees} = await buildTree(install.resolver, install.linker, filteredPatterns, opts);
  reporter.tree('ls', trees);
}

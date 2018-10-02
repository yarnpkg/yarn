/* @flow */

import type PackageResolver from './package-resolver.js';
import type PackageLinker from './package-linker.js';
import type {HoistManifest} from './package-hoister.js';

const invariant = require('invariant');

export type HoistedTree = {
  name: string,
  version: string,
  manifest: HoistManifest,
  children?: HoistedTrees,
};
export type HoistedTrees = Array<HoistedTree>;

export function getParent(key: string, treesByKey: Object): Object {
  const parentKey = key.split('#').slice(0, -1).join('#');
  return treesByKey[parentKey];
}

export async function buildTree(
  resolver: PackageResolver,
  linker: PackageLinker,
  patterns: Array<string>,
  ignoreHoisted?: boolean,
): Promise<HoistedTrees> {
  const treesByKey = {};
  const trees = [];
  const flatTree = await linker.getFlatHoistedTree(patterns);

  // If using workspaces, filter out the virtual manifest
  const {workspaceLayout} = resolver;
  const hoisted =
    workspaceLayout && workspaceLayout.virtualManifestName
      ? flatTree.filter(([key]) => key.indexOf(workspaceLayout.virtualManifestName) === -1)
      : flatTree;

  const hoistedByKey = {};
  for (const [key, info] of hoisted) {
    hoistedByKey[key] = info;
  }

  // build initial trees
  for (const [, info] of hoisted) {
    const ref = info.pkg._reference;
    // const parent = getParent(info.key, treesByKey);
    const children = [];
    // let depth = 0;
    invariant(ref, 'expected reference');

    // check parent to obtain next depth
    // if (parent && parent.depth > 0) {
    //   depth = parent.depth + 1;
    // } else {
    //   depth = 0;
    // }

    treesByKey[info.key] = {
      name: info.pkg.name,
      version: info.pkg.version,
      children,
      manifest: info,
    };
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

  return trees;
}

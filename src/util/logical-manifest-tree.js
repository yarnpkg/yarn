/* @flow */

import npmLogicalTree from 'npm-logical-tree';
import pacote from 'pacote';
import os from 'os';
import path from 'path';

import type {Manifest} from '../types.js';

export class LogicalManifestTree {
  constructor(packageJson: string, packageLock: string, packageDir: string) {
    this.tree = npmLogicalTree(JSON.parse(packageJson), JSON.parse(packageLock));
    this.packageDir = packageDir;
  }

  tree: Object;
  packageDir: string;

  _fetchManifest(node: Object): Promise<Manifest> {
    const version = node.version.replace(/^file:/, `file:${this.packageDir}${path.sep}`);
    return pacote.manifest(`${node.name}@${version}`, {cache: os.tmpdir()});
  }
  _findNode(name: string, parentNames?: Array<string>): Object {
    const parentTree = parentNames
      ? parentNames.reduce((node, ancestor) => {
          const ancestorNode = node.dependencies.get(ancestor);
          return ancestorNode;
        }, this.tree)
      : this.tree;
    const node = parentTree.dependencies.get(name);
    return node;
  }
  getManifestFor(name: string, parentNames?: Array<string>): Promise<Manifest> {
    const node = this._findNode(name, parentNames);
    return this._fetchManifest(node);
  }
}

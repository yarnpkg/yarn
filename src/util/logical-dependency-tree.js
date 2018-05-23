/* @flow */

import npmLogicalTree from 'npm-logical-tree';

export class LogicalDependencyTree {
  constructor(packageJson: string, packageLock: string) {
    this.tree = npmLogicalTree(JSON.parse(packageJson), JSON.parse(packageLock));
  }

  tree: Object;

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
  getFixedVersionPattern(name: string, parentNames?: Array<string>): string {
    const node = this._findNode(name, parentNames);
    const version = node.version;
    return `${node.name}@${version}`;
  }
}

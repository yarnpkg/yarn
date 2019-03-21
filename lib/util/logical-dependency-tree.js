'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LogicalDependencyTree = undefined;

var _npmLogicalTree;

function _load_npmLogicalTree() {
  return _npmLogicalTree = _interopRequireDefault(require('npm-logical-tree'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class LogicalDependencyTree {
  constructor(packageJson, packageLock) {
    this.tree = (0, (_npmLogicalTree || _load_npmLogicalTree()).default)(JSON.parse(packageJson), JSON.parse(packageLock));
  }

  _findNode(name, parentNames) {
    const parentTree = parentNames ? parentNames.reduce((node, ancestor) => {
      const ancestorNode = node.dependencies.get(ancestor);
      return ancestorNode;
    }, this.tree) : this.tree;
    const node = parentTree.dependencies.get(name);
    return node;
  }
  getFixedVersionPattern(name, parentNames) {
    const node = this._findNode(name, parentNames);
    const version = node.version;
    return `${node.name}@${version}`;
  }
}
exports.LogicalDependencyTree = LogicalDependencyTree;
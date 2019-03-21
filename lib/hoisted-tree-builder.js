'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildTree = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let buildTree = exports.buildTree = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (resolver, linker, patterns, ignoreHoisted) {
    const treesByKey = {};
    const trees = [];
    const flatTree = yield linker.getFlatHoistedTree(patterns);

    // If using workspaces, filter out the virtual manifest
    const workspaceLayout = resolver.workspaceLayout;

    const hoisted = workspaceLayout && workspaceLayout.virtualManifestName ? flatTree.filter(function ([key]) {
      return key.indexOf(workspaceLayout.virtualManifestName) === -1;
    }) : flatTree;

    const hoistedByKey = {};
    for (var _iterator = hoisted, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref3;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref3 = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref3 = _i.value;
      }

      const _ref2 = _ref3;
      const key = _ref2[0];
      const info = _ref2[1];

      hoistedByKey[key] = info;
    }

    // build initial trees
    for (var _iterator2 = hoisted, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref5;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref5 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref5 = _i2.value;
      }

      const _ref4 = _ref5;
      const info = _ref4[1];

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
        manifest: info
      };
    }

    // add children
    for (var _iterator3 = hoisted, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
      var _ref7;

      if (_isArray3) {
        if (_i3 >= _iterator3.length) break;
        _ref7 = _iterator3[_i3++];
      } else {
        _i3 = _iterator3.next();
        if (_i3.done) break;
        _ref7 = _i3.value;
      }

      const _ref6 = _ref7;
      const info = _ref6[1];

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
  });

  return function buildTree(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

exports.getParent = getParent;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');

function getParent(key, treesByKey) {
  const parentKey = key.split('#').slice(0, -1).join('#');
  return treesByKey[parentKey];
}
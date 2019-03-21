'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.buildTree = exports.requireLockfile = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let buildTree = exports.buildTree = (() => {
  var _ref2 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (resolver, linker, patterns, opts, onlyFresh, ignoreHoisted) {
    const treesByKey = {};
    const trees = [];
    const flatTree = yield linker.getFlatHoistedTree(patterns);

    // If using workspaces, filter out the virtual manifest
    const workspaceLayout = resolver.workspaceLayout;

    const hoisted = workspaceLayout && workspaceLayout.virtualManifestName ? flatTree.filter(function ([key]) {
      return key.indexOf(workspaceLayout.virtualManifestName) === -1;
    }) : flatTree;

    const hoistedByKey = {};
    for (var _iterator2 = hoisted, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref4;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref4 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref4 = _i2.value;
      }

      const _ref3 = _ref4;
      const key = _ref3[0];
      const info = _ref3[1];

      hoistedByKey[key] = info;
    }

    // build initial trees
    for (var _iterator3 = hoisted, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
      var _ref6;

      if (_isArray3) {
        if (_i3 >= _iterator3.length) break;
        _ref6 = _iterator3[_i3++];
      } else {
        _i3 = _iterator3.next();
        if (_i3.done) break;
        _ref6 = _i3.value;
      }

      const _ref5 = _ref6;
      const info = _ref5[1];

      const ref = info.pkg._reference;
      const hint = null;
      const parent = getParent(info.key, treesByKey);
      const children = [];
      let depth = 0;
      let color = 'bold';
      invariant(ref, 'expected reference');

      if (onlyFresh) {
        let isFresh = false;
        for (var _iterator5 = ref.patterns, _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
          var _ref9;

          if (_isArray5) {
            if (_i5 >= _iterator5.length) break;
            _ref9 = _iterator5[_i5++];
          } else {
            _i5 = _iterator5.next();
            if (_i5.done) break;
            _ref9 = _i5.value;
          }

          const pattern = _ref9;

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
      const nextDepthIsValid = depth + 1 <= Number(opts.reqDepth);

      if (topLevel || nextDepthIsValid || showAll) {
        treesByKey[info.key] = {
          name: `${info.pkg.name}@${info.pkg.version}`,
          children,
          hint,
          color,
          depth
        };
      }

      // add in dummy children for hoisted dependencies
      const nextChildDepthIsValid = depth + 1 < Number(opts.reqDepth);
      invariant(ref, 'expected reference');
      if (!ignoreHoisted && nextDepthIsValid || showAll) {
        for (var _iterator6 = resolver.dedupePatterns(ref.dependencies), _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
          var _ref10;

          if (_isArray6) {
            if (_i6 >= _iterator6.length) break;
            _ref10 = _iterator6[_i6++];
          } else {
            _i6 = _iterator6.next();
            if (_i6.done) break;
            _ref10 = _i6.value;
          }

          const pattern = _ref10;

          const pkg = resolver.getStrictResolvedPattern(pattern);

          if (!hoistedByKey[`${info.key}#${pkg.name}`] && (nextChildDepthIsValid || showAll)) {
            children.push({
              name: pattern,
              color: 'dim',
              shadow: true
            });
          }
        }
      }
    }

    // add children
    for (var _iterator4 = hoisted, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
      var _ref8;

      if (_isArray4) {
        if (_i4 >= _iterator4.length) break;
        _ref8 = _iterator4[_i4++];
      } else {
        _i4 = _iterator4.next();
        if (_i4.done) break;
        _ref8 = _i4.value;
      }

      const _ref7 = _ref8;
      const info = _ref7[1];

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

    return { trees, count: buildCount(trees) };
  });

  return function buildTree(_x, _x2, _x3, _x4, _x5, _x6) {
    return _ref2.apply(this, arguments);
  };
})();

let run = exports.run = (() => {
  var _ref11 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    const lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.lockfileFolder, reporter);
    const install = new (_install || _load_install()).Install(flags, config, reporter, lockfile);

    var _ref12 = yield install.fetchRequestFromCwd();

    const depRequests = _ref12.requests,
          patterns = _ref12.patterns,
          manifest = _ref12.manifest,
          workspaceLayout = _ref12.workspaceLayout;

    yield install.resolver.init(depRequests, {
      isFlat: install.flags.flat,
      isFrozen: install.flags.frozenLockfile,
      workspaceLayout
    });

    let activePatterns = [];
    if (config.production) {
      const devDeps = getDevDeps(manifest);
      activePatterns = patterns.filter(function (pattern) {
        return !devDeps.has(pattern);
      });
    } else {
      activePatterns = patterns;
    }

    const opts = {
      reqDepth: getReqDepth(flags.depth)
    };

    var _ref13 = yield buildTree(install.resolver, install.linker, activePatterns, opts);

    let trees = _ref13.trees;


    if (args.length) {
      reporter.warn(reporter.lang('deprecatedListArgs'));
    }
    if (args.length || flags.pattern) {
      trees = trees.filter(function (tree) {
        return filterTree(tree, args, flags.pattern);
      });
    }

    reporter.tree('list', trees, { force: true });
  });

  return function run(_x7, _x8, _x9, _x10) {
    return _ref11.apply(this, arguments);
  };
})();

exports.getParent = getParent;
exports.hasWrapper = hasWrapper;
exports.setFlags = setFlags;
exports.getReqDepth = getReqDepth;
exports.filterTree = filterTree;
exports.getDevDeps = getDevDeps;

var _install;

function _load_install() {
  return _install = require('./install.js');
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../../lockfile'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');

const micromatch = require('micromatch');

const requireLockfile = exports.requireLockfile = true;

function buildCount(trees) {
  if (!trees || !trees.length) {
    return 0;
  }

  let count = 0;

  for (var _iterator = trees, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
    var _ref;

    if (_isArray) {
      if (_i >= _iterator.length) break;
      _ref = _iterator[_i++];
    } else {
      _i = _iterator.next();
      if (_i.done) break;
      _ref = _i.value;
    }

    const tree = _ref;

    if (tree.shadow) {
      continue;
    }

    count++;
    count += buildCount(tree.children);
  }

  return count;
}

function getParent(key, treesByKey) {
  const parentKey = key.split('#').slice(0, -1).join('#');
  return treesByKey[parentKey];
}

function hasWrapper(commander, args) {
  return true;
}

function setFlags(commander) {
  commander.description('Lists installed packages.');
  commander.option('--depth [depth]', 'Limit the depth of the shown dependencies');
  commander.option('--pattern [pattern]', 'Filter dependencies by pattern');
}

function getReqDepth(inputDepth) {
  return inputDepth && /^\d+$/.test(inputDepth) ? Number(inputDepth) : -1;
}

function filterTree(tree, filters, pattern = '') {
  if (tree.children) {
    tree.children = tree.children.filter(child => filterTree(child, filters, pattern));
  }

  const notDim = tree.color !== 'dim';
  const hasChildren = tree.children == null ? false : tree.children.length > 0;
  const name = tree.name.slice(0, tree.name.lastIndexOf('@'));
  const found = micromatch.any(name, filters) || micromatch.contains(name, pattern);

  return notDim && (found || hasChildren);
}

function getDevDeps(manifest) {
  if (manifest.devDependencies) {
    return new Set(Object.keys(manifest.devDependencies).map(key => `${key}@${manifest.devDependencies[key]}`));
  } else {
    return new Set();
  }
}
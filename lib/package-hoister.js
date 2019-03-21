'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NohoistResolver = exports.HoistManifest = undefined;

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

var _config;

function _load_config() {
  return _config = _interopRequireDefault(require('./config.js'));
}

var _misc;

function _load_misc() {
  return _misc = require('./util/misc.js');
}

var _micromatch;

function _load_micromatch() {
  return _micromatch = _interopRequireDefault(require('micromatch'));
}

var _workspaceLayout2;

function _load_workspaceLayout() {
  return _workspaceLayout2 = _interopRequireDefault(require('./workspace-layout.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');

const path = require('path');

let historyCounter = 0;

const LINK_TYPES = new Set(['workspace', 'link']);
class HoistManifest {
  constructor(key, parts, pkg, loc, isDirectRequire, isRequired, isIncompatible) {
    this.isDirectRequire = isDirectRequire;
    this.isRequired = isRequired;
    this.isIncompatible = isIncompatible;

    this.loc = loc;
    this.pkg = pkg;
    this.key = key;
    this.parts = parts;
    this.originalKey = key;
    this.previousPaths = [];

    this.history = [];
    this.addHistory(`Start position = ${key}`);

    this.isNohoist = false;
    this.originalParentPath = '';

    this.shallowPaths = [];
    this.isShallow = false;
  }

  //focus


  // nohoist info


  addHistory(msg) {
    this.history.push(`${++historyCounter}: ${msg}`);
  }
}

exports.HoistManifest = HoistManifest;
class PackageHoister {
  constructor(config, resolver, { ignoreOptional, workspaceLayout } = {}) {
    this.resolver = resolver;
    this.config = config;

    this.ignoreOptional = ignoreOptional;

    this.taintedKeys = new Map();
    this.levelQueue = [];
    this.tree = new Map();

    this.workspaceLayout = workspaceLayout;

    this.nohoistResolver = new NohoistResolver(config, resolver);
  }

  /**
   * Taint this key and prevent any modules from being hoisted to it.
   */

  taintKey(key, info) {
    const existingTaint = this.taintedKeys.get(key);
    if (existingTaint && existingTaint.loc !== info.loc) {
      return false;
    } else {
      this.taintedKeys.set(key, info);
      return true;
    }
  }

  /**
   * Implode an array of ancestry parts into a key.
   */

  implodeKey(parts) {
    return parts.join('#');
  }

  /**
   * Seed the hoister with patterns taken from the included resolver.
   */

  seed(patterns) {
    this.prepass(patterns);

    for (var _iterator = this.resolver.dedupePatterns(patterns), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref = _i.value;
      }

      const pattern = _ref;

      this._seed(pattern, { isDirectRequire: true });
    }

    while (true) {
      let queue = this.levelQueue;
      if (!queue.length) {
        this._propagateRequired();
        return;
      }

      this.levelQueue = [];

      // sort queue to get determinism between runs
      queue = queue.sort(([aPattern], [bPattern]) => {
        return (0, (_misc || _load_misc()).sortAlpha)(aPattern, bPattern);
      });

      // sort the queue again to hoist packages without peer dependencies first
      let sortedQueue = [];
      const availableSet = new Set();

      let hasChanged = true;
      while (queue.length > 0 && hasChanged) {
        hasChanged = false;

        const queueCopy = queue;
        queue = [];
        for (let t = 0; t < queueCopy.length; ++t) {
          const queueItem = queueCopy[t];
          const pattern = queueItem[0];
          const pkg = this.resolver.getStrictResolvedPattern(pattern);

          const peerDependencies = Object.keys(pkg.peerDependencies || {});
          const areDependenciesFulfilled = peerDependencies.every(peerDependency => availableSet.has(peerDependency));

          if (areDependenciesFulfilled) {
            // Move the package inside our sorted queue
            sortedQueue.push(queueItem);

            // Add it to our set, so that we know it is available
            availableSet.add(pattern);

            // Schedule a next pass, in case other packages had peer dependencies on this one
            hasChanged = true;
          } else {
            queue.push(queueItem);
          }
        }
      }

      // We might end up with some packages left in the queue, that have not been sorted. We reach this codepath if two
      // packages have a cyclic dependency, or if the peer dependency is provided by a parent package. In these case,
      // nothing we can do, so we just add all of these packages to the end of the sorted queue.
      sortedQueue = sortedQueue.concat(queue);

      for (var _iterator2 = sortedQueue, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref3;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref3 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref3 = _i2.value;
        }

        const _ref2 = _ref3;
        const pattern = _ref2[0];
        const parent = _ref2[1];

        const info = this._seed(pattern, { isDirectRequire: false, parent });
        if (info) {
          this.hoist(info);
        }
      }
    }
  }

  /**
   * Seed the hoister with a specific pattern.
   */

  _seed(pattern, { isDirectRequire, parent }) {
    //
    const pkg = this.resolver.getStrictResolvedPattern(pattern);
    const ref = pkg._reference;
    invariant(ref, 'expected reference');

    //
    let parentParts = [];

    const isIncompatible = ref.incompatible;
    const isMarkedAsOptional = ref.optional && this.ignoreOptional;

    let isRequired = isDirectRequire && !ref.ignore && !isIncompatible && !isMarkedAsOptional;

    if (parent) {
      if (!this.tree.get(parent.key)) {
        return null;
      }
      // non ignored dependencies inherit parent's ignored status
      // parent may transition from ignored to non ignored when hoisted if it is used in another non ignored branch
      if (!isDirectRequire && !isIncompatible && parent.isRequired && !isMarkedAsOptional) {
        isRequired = true;
      }
      parentParts = parent.parts;
    }

    //
    const loc = this.config.generateModuleCachePath(ref);
    const parts = parentParts.concat(pkg.name);
    const key = this.implodeKey(parts);
    const info = new HoistManifest(key, parts, pkg, loc, isDirectRequire, isRequired, isIncompatible);

    this.nohoistResolver.initNohoist(info, parent);

    this.tree.set(key, info);
    this.taintKey(key, info);

    //
    const pushed = new Set();
    for (var _iterator3 = ref.dependencies, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
      var _ref4;

      if (_isArray3) {
        if (_i3 >= _iterator3.length) break;
        _ref4 = _iterator3[_i3++];
      } else {
        _i3 = _iterator3.next();
        if (_i3.done) break;
        _ref4 = _i3.value;
      }

      const depPattern = _ref4;

      if (!pushed.has(depPattern)) {
        this.levelQueue.push([depPattern, info]);
        pushed.add(depPattern);
      }
    }

    return info;
  }

  /**
   * Propagate inherited ignore statuses from non-ignored to ignored packages
   */

  _propagateRequired() {
    //
    const toVisit = [];

    // enumerate all non-ignored packages
    for (var _iterator4 = this.tree.entries(), _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
      var _ref5;

      if (_isArray4) {
        if (_i4 >= _iterator4.length) break;
        _ref5 = _iterator4[_i4++];
      } else {
        _i4 = _iterator4.next();
        if (_i4.done) break;
        _ref5 = _i4.value;
      }

      const entry = _ref5;

      if (entry[1].isRequired) {
        toVisit.push(entry[1]);
      }
    }

    // visit them
    while (toVisit.length) {
      const info = toVisit.shift();
      const ref = info.pkg._reference;
      invariant(ref, 'expected reference');

      for (var _iterator5 = ref.dependencies, _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
        var _ref6;

        if (_isArray5) {
          if (_i5 >= _iterator5.length) break;
          _ref6 = _iterator5[_i5++];
        } else {
          _i5 = _iterator5.next();
          if (_i5.done) break;
          _ref6 = _i5.value;
        }

        const depPattern = _ref6;

        const depinfo = this._lookupDependency(info, depPattern);

        if (!depinfo) {
          continue;
        }

        const depRef = depinfo.pkg._reference;

        // If it's marked as optional, but the parent is required and the
        // dependency was not listed in `optionalDependencies`, then we mark the
        // dependency as required.
        const isMarkedAsOptional = depRef && depRef.optional && this.ignoreOptional && !(info.isRequired && depRef.hint !== 'optional');

        if (!depinfo.isRequired && !depinfo.isIncompatible && !isMarkedAsOptional) {
          depinfo.isRequired = true;
          depinfo.addHistory(`Mark as non-ignored because of usage by ${info.key}`);
          toVisit.push(depinfo);
        }
      }
    }
  }

  /**
   * Looks up the package a dependency resolves to
   */

  _lookupDependency(info, depPattern) {
    //
    const pkg = this.resolver.getStrictResolvedPattern(depPattern);
    const ref = pkg._reference;
    invariant(ref, 'expected reference');

    //
    for (let i = info.parts.length; i >= 0; i--) {
      const checkParts = info.parts.slice(0, i).concat(pkg.name);
      const checkKey = this.implodeKey(checkParts);
      const existing = this.tree.get(checkKey);
      if (existing) {
        return existing;
      }
    }

    return null;
  }

  /**
   * Find the highest position we can hoist this module to.
   */

  getNewParts(key, info, parts) {
    let stepUp = false;

    const highestHoistingPoint = this.nohoistResolver.highestHoistingPoint(info) || 0;
    const fullKey = this.implodeKey(parts);
    const stack = []; // stack of removed parts
    const name = parts.pop();

    if (info.isNohoist) {
      info.addHistory(`Marked as nohoist, will not be hoisted above '${parts[highestHoistingPoint]}'`);
    }

    for (let i = parts.length - 1; i >= highestHoistingPoint; i--) {
      const checkParts = parts.slice(0, i).concat(name);
      const checkKey = this.implodeKey(checkParts);
      info.addHistory(`Looked at ${checkKey} for a match`);

      const existing = this.tree.get(checkKey);

      if (existing) {
        if (existing.loc === info.loc) {
          // switch to non ignored if earlier deduped version was ignored (must be compatible)
          if (!existing.isRequired && info.isRequired) {
            existing.addHistory(`Deduped ${fullKey} to this item, marking as required`);
            existing.isRequired = true;
          } else {
            existing.addHistory(`Deduped ${fullKey} to this item`);
          }

          return { parts: checkParts, duplicate: true };
        } else {
          // everything above will be shadowed and this is a conflict
          info.addHistory(`Found a collision at ${checkKey}`);
          break;
        }
      }

      const existingTaint = this.taintedKeys.get(checkKey);
      if (existingTaint && existingTaint.loc !== info.loc) {
        info.addHistory(`Broken by ${checkKey}`);
        break;
      }
    }

    const peerDependencies = Object.keys(info.pkg.peerDependencies || {});

    // remove redundant parts that wont collide
    hoistLoop: while (parts.length > highestHoistingPoint) {
      // we must not hoist a package higher than its peer dependencies
      for (var _iterator6 = peerDependencies, _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
        var _ref7;

        if (_isArray6) {
          if (_i6 >= _iterator6.length) break;
          _ref7 = _iterator6[_i6++];
        } else {
          _i6 = _iterator6.next();
          if (_i6.done) break;
          _ref7 = _i6.value;
        }

        const peerDependency = _ref7;

        const checkParts = parts.concat(peerDependency);
        const checkKey = this.implodeKey(checkParts);
        info.addHistory(`Looked at ${checkKey} for a peer dependency match`);

        const existing = this.tree.get(checkKey);

        if (existing) {
          info.addHistory(`Found a peer dependency requirement at ${checkKey}`);
          break hoistLoop;
        }
      }

      const checkParts = parts.concat(name);
      const checkKey = this.implodeKey(checkParts);

      //
      const existing = this.tree.get(checkKey);
      if (existing) {
        stepUp = true;
        break;
      }

      // check if we're trying to hoist ourselves to a previously unflattened module key,
      // this will result in a conflict and we'll need to move ourselves up
      if (key !== checkKey && this.taintedKeys.has(checkKey)) {
        stepUp = true;
        break;
      }

      //
      stack.push(parts.pop());
    }

    //
    parts.push(name);

    //
    const isValidPosition = parts => {
      // nohoist package can't be hoisted to the "root"
      if (parts.length <= highestHoistingPoint) {
        return false;
      }
      const key = this.implodeKey(parts);
      const existing = this.tree.get(key);
      if (existing && existing.loc === info.loc) {
        return true;
      }

      // ensure there's no taint or the taint is us
      const existingTaint = this.taintedKeys.get(key);
      if (existingTaint && existingTaint.loc !== info.loc) {
        return false;
      }

      return true;
    };

    // we need to special case when we attempt to hoist to the top level as the `existing` logic
    // wont be hit in the above `while` loop and we could conflict
    if (!isValidPosition(parts)) {
      stepUp = true;
    }

    // sometimes we need to step up to a parent module to install ourselves
    while (stepUp && stack.length) {
      info.addHistory(`Stepping up from ${this.implodeKey(parts)}`);

      parts.pop(); // remove `name`
      parts.push(stack.pop(), name);

      if (isValidPosition(parts)) {
        info.addHistory(`Found valid position ${this.implodeKey(parts)}`);
        stepUp = false;
      }
    }

    return { parts, duplicate: false };
  }

  /**
   * Hoist all seeded patterns to their highest positions.
   */

  hoist(info) {
    const oldKey = info.key,
          rawParts = info.parts;

    // remove this item from the `tree` map so we can ignore it

    this.tree.delete(oldKey);

    var _getNewParts = this.getNewParts(oldKey, info, rawParts.slice());

    const parts = _getNewParts.parts,
          duplicate = _getNewParts.duplicate;


    const newKey = this.implodeKey(parts);
    if (duplicate) {
      info.addHistory(`Satisfied from above by ${newKey}`);
      this.declareRename(info, rawParts, parts);
      this.updateHoistHistory(this.nohoistResolver._originalPath(info), this.implodeKey(parts));
      return;
    }

    // update to the new key
    if (oldKey === newKey) {
      info.addHistory(`Didn't hoist - see reason above`);
      this.setKey(info, oldKey, rawParts);
      return;
    }

    //
    this.declareRename(info, rawParts, parts);
    this.setKey(info, newKey, parts);
  }

  /**
   * Declare that a module has been hoisted and update our internal references.
   */

  declareRename(info, oldParts, newParts) {
    // go down the tree from our new position reserving our name
    this.taintParents(info, oldParts.slice(0, -1), newParts.length - 1);
  }

  /**
   * Crawl upwards through a list of ancestry parts and taint a package name.
   */

  taintParents(info, processParts, start) {
    for (let i = start; i < processParts.length; i++) {
      const parts = processParts.slice(0, i).concat(info.pkg.name);
      const key = this.implodeKey(parts);

      if (this.taintKey(key, info)) {
        info.addHistory(`Tainted ${key} to prevent collisions`);
      }
    }
  }

  updateHoistHistory(fromPath, toKey) {
    const info = this.tree.get(toKey);
    invariant(info, `expect to find hoist-to ${toKey}`);
    info.previousPaths.push(fromPath);
  }

  /**
   * Update the key of a module and update our references.
   */

  setKey(info, newKey, parts) {
    const oldKey = info.key;

    info.key = newKey;
    info.parts = parts;
    this.tree.set(newKey, info);

    if (oldKey === newKey) {
      return;
    }

    const fromInfo = this.tree.get(newKey);
    invariant(fromInfo, `expect to find hoist-from ${newKey}`);
    info.previousPaths.push(this.nohoistResolver._originalPath(fromInfo));
    info.addHistory(`New position = ${newKey}`);
  }

  /**
   * Perform a prepass and if there's multiple versions of the same package, hoist the one with
   * the most dependents to the top.
   */

  prepass(patterns) {
    patterns = this.resolver.dedupePatterns(patterns).sort();

    const visited = new Map();

    const occurences = {};

    // visitor to be used inside add() to mark occurences of packages
    const visitAdd = (pkg, ancestry, pattern) => {
      const versions = occurences[pkg.name] = occurences[pkg.name] || {};
      const version = versions[pkg.version] = versions[pkg.version] || {
        occurences: new Set(),
        pattern
      };

      if (ancestry.length) {
        version.occurences.add(ancestry[ancestry.length - 1]);
      }
    };

    // add an occurring package to the above data structure
    const add = (pattern, ancestry, ancestryPatterns) => {
      const pkg = this.resolver.getStrictResolvedPattern(pattern);
      if (ancestry.indexOf(pkg) >= 0) {
        // prevent recursive dependencies
        return;
      }

      let visitedPattern = visited.get(pattern);

      if (visitedPattern) {
        // if a package has been visited before, simply increment occurrences of packages
        // like last time this package was visited
        visitedPattern.forEach(visitPkg => {
          visitAdd(visitPkg.pkg, visitPkg.ancestry, visitPkg.pattern);
        });

        visitAdd(pkg, ancestry, pattern);

        return;
      }

      const ref = pkg._reference;
      invariant(ref, 'expected reference');

      visitAdd(pkg, ancestry, pattern);

      for (var _iterator7 = ref.dependencies, _isArray7 = Array.isArray(_iterator7), _i7 = 0, _iterator7 = _isArray7 ? _iterator7 : _iterator7[Symbol.iterator]();;) {
        var _ref8;

        if (_isArray7) {
          if (_i7 >= _iterator7.length) break;
          _ref8 = _iterator7[_i7++];
        } else {
          _i7 = _iterator7.next();
          if (_i7.done) break;
          _ref8 = _i7.value;
        }

        const depPattern = _ref8;

        const depAncestry = ancestry.concat(pkg);
        const depAncestryPatterns = ancestryPatterns.concat(depPattern);
        add(depPattern, depAncestry, depAncestryPatterns);
      }

      visitedPattern = visited.get(pattern) || [];
      visited.set(pattern, visitedPattern);
      visitedPattern.push({ pkg, ancestry, pattern });

      ancestryPatterns.forEach(ancestryPattern => {
        const visitedAncestryPattern = visited.get(ancestryPattern);
        if (visitedAncestryPattern) {
          visitedAncestryPattern.push({ pkg, ancestry, pattern });
        }
      });
    };

    // get a list of root package names since we can't hoist other dependencies to these spots!
    const rootPackageNames = new Set();
    for (var _iterator8 = patterns, _isArray8 = Array.isArray(_iterator8), _i8 = 0, _iterator8 = _isArray8 ? _iterator8 : _iterator8[Symbol.iterator]();;) {
      var _ref9;

      if (_isArray8) {
        if (_i8 >= _iterator8.length) break;
        _ref9 = _iterator8[_i8++];
      } else {
        _i8 = _iterator8.next();
        if (_i8.done) break;
        _ref9 = _i8.value;
      }

      const pattern = _ref9;

      const pkg = this.resolver.getStrictResolvedPattern(pattern);
      rootPackageNames.add(pkg.name);
      add(pattern, [], []);
    }

    for (var _iterator9 = Object.keys(occurences).sort(), _isArray9 = Array.isArray(_iterator9), _i9 = 0, _iterator9 = _isArray9 ? _iterator9 : _iterator9[Symbol.iterator]();;) {
      var _ref10;

      if (_isArray9) {
        if (_i9 >= _iterator9.length) break;
        _ref10 = _iterator9[_i9++];
      } else {
        _i9 = _iterator9.next();
        if (_i9.done) break;
        _ref10 = _i9.value;
      }

      const packageName = _ref10;

      const versionOccurences = occurences[packageName];
      const versions = Object.keys(versionOccurences);

      if (versions.length === 1) {
        // only one package type so we'll hoist this to the top anyway
        continue;
      }

      if (this.tree.get(packageName)) {
        // a transitive dependency of a previously hoisted dependency exists
        continue;
      }

      if (rootPackageNames.has(packageName)) {
        // can't replace top level packages
        continue;
      }

      let mostOccurenceCount;
      let mostOccurencePattern;
      for (var _iterator10 = Object.keys(versionOccurences).sort(), _isArray10 = Array.isArray(_iterator10), _i10 = 0, _iterator10 = _isArray10 ? _iterator10 : _iterator10[Symbol.iterator]();;) {
        var _ref11;

        if (_isArray10) {
          if (_i10 >= _iterator10.length) break;
          _ref11 = _iterator10[_i10++];
        } else {
          _i10 = _iterator10.next();
          if (_i10.done) break;
          _ref11 = _i10.value;
        }

        const version = _ref11;
        var _versionOccurences$ve = versionOccurences[version];
        const occurences = _versionOccurences$ve.occurences,
              pattern = _versionOccurences$ve.pattern;

        const occurenceCount = occurences.size;

        if (!mostOccurenceCount || occurenceCount > mostOccurenceCount) {
          mostOccurenceCount = occurenceCount;
          mostOccurencePattern = pattern;
        }
      }
      invariant(mostOccurencePattern, 'expected most occurring pattern');
      invariant(mostOccurenceCount, 'expected most occurring count');

      // only hoist this module if it occured more than once
      if (mostOccurenceCount > 1) {
        this._seed(mostOccurencePattern, { isDirectRequire: false });
      }
    }
  }

  markShallowWorkspaceEntries() {
    const targetWorkspace = this.config.focusedWorkspaceName;
    const targetHoistManifest = this.tree.get(targetWorkspace);
    invariant(targetHoistManifest, `targetHoistManifest from ${targetWorkspace} missing`);

    //dedupe with a set
    const dependentWorkspaces = Array.from(new Set(this._getDependentWorkspaces(targetHoistManifest)));

    const entries = Array.from(this.tree);
    entries.forEach(([key, info]) => {
      const splitPath = key.split('#');

      //mark the workspace and any un-hoisted dependencies it has for shallow installation
      const isShallowDependency = dependentWorkspaces.some(w => {
        if (splitPath[0] !== w) {
          //entry is not related to the workspace
          return false;
        }
        if (!splitPath[1]) {
          //entry is the workspace
          return true;
        }
        //don't bother marking dev dependencies or nohoist packages for shallow installation
        const treeEntry = this.tree.get(w);
        invariant(treeEntry, 'treeEntry is not defined for ' + w);
        const pkg = treeEntry.pkg;
        return !info.isNohoist && (!pkg.devDependencies || !(splitPath[1] in pkg.devDependencies));
      });

      if (isShallowDependency) {
        info.shallowPaths = [null];
        return;
      }

      //if package foo is at TARGET_WORKSPACE/node_modules/foo, the hoisted version of foo
      //should be installed under each shallow workspace that uses it
      //(unless that workspace has its own version of foo, in which case that should be installed)
      if (splitPath.length !== 2 || splitPath[0] !== targetWorkspace) {
        return;
      }
      const unhoistedDependency = splitPath[1];
      const unhoistedInfo = this.tree.get(unhoistedDependency);
      if (!unhoistedInfo) {
        return;
      }
      dependentWorkspaces.forEach(w => {
        if (this._packageDependsOnHoistedPackage(w, unhoistedDependency, false)) {
          unhoistedInfo.shallowPaths.push(w);
        }
      });
    });
  }

  _getDependentWorkspaces(parent, allowDevDeps = true, alreadySeen = new Set()) {
    const parentName = parent.pkg.name;
    if (alreadySeen.has(parentName)) {
      return [];
    }

    alreadySeen.add(parentName);
    invariant(this.workspaceLayout, 'missing workspaceLayout');
    var _workspaceLayout = this.workspaceLayout;
    const virtualManifestName = _workspaceLayout.virtualManifestName,
          workspaces = _workspaceLayout.workspaces;


    const directDependencies = [];
    const ignored = [];
    Object.keys(workspaces).forEach(workspace => {
      if (alreadySeen.has(workspace) || workspace === virtualManifestName) {
        return;
      }

      //skip a workspace if a different version of it is already being installed under the parent workspace
      let info = this.tree.get(`${parentName}#${workspace}`);
      if (info) {
        const workspaceVersion = workspaces[workspace].manifest.version;
        if (info.isNohoist && info.originalParentPath.startsWith(`/${WS_ROOT_ALIAS}/${parentName}`) && info.pkg.version === workspaceVersion) {
          //nohoist installations are exceptions
          directDependencies.push(info.key);
        } else {
          ignored.push(workspace);
        }
        return;
      }

      const searchPath = `/${WS_ROOT_ALIAS}/${parentName}`;
      info = this.tree.get(workspace);
      invariant(info, 'missing workspace tree entry ' + workspace);
      if (!info.previousPaths.some(p => p.startsWith(searchPath))) {
        return;
      }
      if (allowDevDeps || !parent.pkg.devDependencies || !(workspace in parent.pkg.devDependencies)) {
        directDependencies.push(workspace);
      }
    });

    let nested = directDependencies.map(d => {
      const dependencyEntry = this.tree.get(d);
      invariant(dependencyEntry, 'missing dependencyEntry ' + d);
      return this._getDependentWorkspaces(dependencyEntry, false, alreadySeen);
    });
    nested = [].concat.apply([], nested); //flatten

    const directDependencyNames = directDependencies.map(d => d.split('#').slice(-1)[0]);

    return directDependencyNames.concat(nested).filter(w => ignored.indexOf(w) === -1);
  }

  _packageDependsOnHoistedPackage(p, hoisted, checkDevDeps = true, checked = new Set()) {
    //don't check the same package more than once, and ignore any package that has its own version of hoisted
    if (checked.has(p) || this.tree.has(`${p}#${hoisted}`)) {
      return false;
    }
    checked.add(p);
    const info = this.tree.get(p);
    if (!info) {
      return false;
    }

    const pkg = info.pkg;
    if (!pkg) {
      return false;
    }

    let deps = [];
    if (pkg.dependencies) {
      deps = deps.concat(Object.keys(pkg.dependencies));
    }
    if (checkDevDeps && pkg.devDependencies) {
      deps = deps.concat(Object.keys(pkg.devDependencies));
    }

    if (deps.indexOf(hoisted) !== -1) {
      return true;
    }
    return deps.some(dep => this._packageDependsOnHoistedPackage(dep, hoisted, false, checked));
  }

  /**
   * Produce a flattened list of module locations and manifests.
   */

  init() {
    const flatTree = [];

    //
    for (var _iterator11 = this.tree.entries(), _isArray11 = Array.isArray(_iterator11), _i11 = 0, _iterator11 = _isArray11 ? _iterator11 : _iterator11[Symbol.iterator]();;) {
      var _ref13;

      if (_isArray11) {
        if (_i11 >= _iterator11.length) break;
        _ref13 = _iterator11[_i11++];
      } else {
        _i11 = _iterator11.next();
        if (_i11.done) break;
        _ref13 = _i11.value;
      }

      const _ref12 = _ref13;
      const key = _ref12[0];
      const info = _ref12[1];

      // decompress the location and push it to the flat tree. this path could be made
      const parts = [];
      const keyParts = key.split('#');
      for (let i = 0; i < keyParts.length; i++) {
        const key = keyParts.slice(0, i + 1).join('#');
        const hoisted = this.tree.get(key);
        invariant(hoisted, `expected hoisted manifest for "${key}"`);
        parts.push(this.config.getFolder(hoisted.pkg));
        parts.push(keyParts[i]);
      }

      const shallowLocs = [];
      if (this.config.modulesFolder) {
        // remove the first part which will be the folder name and replace it with a
        // hardcoded modules folder
        parts.splice(0, 1, this.config.modulesFolder);
      } else {
        // first part will be the registry-specific module folder
        parts.splice(0, 0, this.config.lockfileFolder);
      }

      info.shallowPaths.forEach(shallowPath => {
        const shallowCopyParts = parts.slice();
        shallowCopyParts[0] = this.config.cwd;
        if (this.config.modulesFolder) {
          //add back the module folder name for the shallow installation
          const treeEntry = this.tree.get(keyParts[0]);
          invariant(treeEntry, 'expected treeEntry for ' + keyParts[0]);
          const moduleFolderName = this.config.getFolder(treeEntry.pkg);
          shallowCopyParts.splice(1, 0, moduleFolderName);
        }

        if (shallowPath) {
          const targetWorkspace = this.config.focusedWorkspaceName;
          const treeEntry = this.tree.get(`${targetWorkspace}#${shallowPath}`) || this.tree.get(shallowPath);
          invariant(treeEntry, 'expected treeEntry for ' + shallowPath);
          const moduleFolderName = this.config.getFolder(treeEntry.pkg);
          shallowCopyParts.splice(1, 0, moduleFolderName, shallowPath);
        }
        shallowLocs.push(path.join(...shallowCopyParts));
      });

      const loc = path.join(...parts);
      flatTree.push([loc, info]);
      shallowLocs.forEach(shallowLoc => {
        const newManifest = (0, (_extends2 || _load_extends()).default)({}, info, { isShallow: true });
        flatTree.push([shallowLoc, newManifest]);
      });
    }

    // remove ignored modules from the tree
    const visibleFlatTree = [];
    for (var _iterator12 = flatTree, _isArray12 = Array.isArray(_iterator12), _i12 = 0, _iterator12 = _isArray12 ? _iterator12 : _iterator12[Symbol.iterator]();;) {
      var _ref15;

      if (_isArray12) {
        if (_i12 >= _iterator12.length) break;
        _ref15 = _iterator12[_i12++];
      } else {
        _i12 = _iterator12.next();
        if (_i12.done) break;
        _ref15 = _i12.value;
      }

      const _ref14 = _ref15;
      const loc = _ref14[0];
      const info = _ref14[1];

      const ref = info.pkg._reference;
      invariant(ref, 'expected reference');
      if (!info.isRequired) {
        info.addHistory('Deleted as this module was ignored');
      } else {
        visibleFlatTree.push([loc, info]);
      }
    }
    return visibleFlatTree;
  }
}

exports.default = PackageHoister;
const WS_ROOT_ALIAS = '_project_';
class NohoistResolver {
  constructor(config, resolver) {
    this.initNohoist = (info, parent) => {
      let parentNohoistList;
      let originalParentPath = info.originalParentPath;

      if (parent) {
        parentNohoistList = parent.nohoistList;
        originalParentPath = this._originalPath(parent);
      } else {
        invariant(this._isTopPackage(info), `${info.key} doesn't have parent nor a top package`);
        if (info.pkg.name !== this._wsRootPackageName) {
          parentNohoistList = this._wsRootNohoistList;
          originalParentPath = this._wsRootPackageName || '';
        }
      }

      info.originalParentPath = originalParentPath;
      let nohoistList = this._extractNohoistList(info.pkg, this._originalPath(info)) || [];
      if (parentNohoistList) {
        nohoistList = nohoistList.concat(parentNohoistList);
      }
      info.nohoistList = nohoistList.length > 0 ? nohoistList : null;
      info.isNohoist = this._isNohoist(info);
    };

    this.highestHoistingPoint = info => {
      return info.isNohoist && info.parts.length > 1 ? 1 : null;
    };

    this._isNohoist = info => {
      if (this._isTopPackage(info)) {
        return false;
      }
      if (info.nohoistList && info.nohoistList.length > 0 && (_micromatch || _load_micromatch()).default.any(this._originalPath(info), info.nohoistList)) {
        return true;
      }
      if (this._config.plugnplayEnabled) {
        return true;
      }
      return false;
    };

    this._isRootPackage = pkg => {
      return pkg.name === this._wsRootPackageName;
    };

    this._originalPath = info => {
      return this._makePath(info.originalParentPath, info.pkg.name);
    };

    this._isTopPackage = info => {
      const parentParts = info.parts.slice(0, -1);
      const result = !parentParts || parentParts.length <= 0 || parentParts.length === 1 && parentParts[0] === this._wsRootPackageName;
      return result;
    };

    this._isLink = info => {
      return info.pkg._remote != null && LINK_TYPES.has(info.pkg._remote.type);
    };

    this._extractNohoistList = (pkg, pathPrefix) => {
      let nohoistList;
      const ws = this._config.getWorkspaces(pkg);

      if (ws && ws.nohoist) {
        nohoistList = ws.nohoist.map(p => this._makePath(pathPrefix, p));
      }
      return nohoistList;
    };

    this._resolver = resolver;
    this._config = config;
    if (resolver.workspaceLayout) {
      this._wsRootPackageName = resolver.workspaceLayout.virtualManifestName;

      var _resolver$workspaceLa = resolver.workspaceLayout.getWorkspaceManifest(this._wsRootPackageName);

      const manifest = _resolver$workspaceLa.manifest;

      this._wsRootNohoistList = this._extractNohoistList(manifest, manifest.name);
    }
  }

  /**
   * examine the top level packages to find the root package
   */


  /**
   * find the highest hoisting point for the given HoistManifest.
   * algorithm: a nohoist package should never be hoisted beyond the top of its branch, i.e.
   * the first element of its parts. Therefore the highest possible hoisting index is 1,
   * unless the package has only 1 part (itself), in such case returns null just like any hoisted package
   *
   */

  // private functions

  _makePath(...args) {
    const parts = args.map(s => s === this._wsRootPackageName ? WS_ROOT_ALIAS : s);
    const result = parts.join('/');
    return result[0] === '/' ? result : '/' + result;
  }

  // extract nohoist from package.json then prefix them with branch path
  // so we can matched against the branch tree ("originalPath") later
}

exports.NohoistResolver = NohoistResolver;
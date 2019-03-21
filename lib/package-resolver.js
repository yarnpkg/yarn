'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _index;

function _load_index() {
  return _index = require('./resolvers/index.js');
}

var _packageRequest;

function _load_packageRequest() {
  return _packageRequest = _interopRequireDefault(require('./package-request.js'));
}

var _normalizePattern2;

function _load_normalizePattern() {
  return _normalizePattern2 = require('./util/normalize-pattern.js');
}

var _requestManager;

function _load_requestManager() {
  return _requestManager = _interopRequireDefault(require('./util/request-manager.js'));
}

var _blockingQueue;

function _load_blockingQueue() {
  return _blockingQueue = _interopRequireDefault(require('./util/blocking-queue.js'));
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('./lockfile'));
}

var _map;

function _load_map() {
  return _map = _interopRequireDefault(require('./util/map.js'));
}

var _workspaceLayout;

function _load_workspaceLayout() {
  return _workspaceLayout = _interopRequireDefault(require('./workspace-layout.js'));
}

var _resolutionMap;

function _load_resolutionMap() {
  return _resolutionMap = _interopRequireDefault(require('./resolution-map.js'));
}

var _resolutionMap2;

function _load_resolutionMap2() {
  return _resolutionMap2 = require('./resolution-map.js');
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');

const semver = require('semver');

class PackageResolver {
  constructor(config, lockfile, resolutionMap = new (_resolutionMap || _load_resolutionMap()).default(config)) {
    this.patternsByPackage = (0, (_map || _load_map()).default)();
    this.fetchingPatterns = new Set();
    this.fetchingQueue = new (_blockingQueue || _load_blockingQueue()).default('resolver fetching');
    this.patterns = (0, (_map || _load_map()).default)();
    this.resolutionMap = resolutionMap;
    this.usedRegistries = new Set();
    this.flat = false;

    this.reporter = config.reporter;
    this.lockfile = lockfile;
    this.config = config;
    this.delayedResolveQueue = [];
  }

  // whether the dependency graph will be flattened


  // list of registries that have been used in this resolution


  // activity monitor


  // patterns we've already resolved or are in the process of resolving


  // TODO


  // manages and throttles json api http requests


  // list of patterns associated with a package


  // lockfile instance which we can use to retrieve version info


  // a map of dependency patterns to packages


  // reporter instance, abstracts out display logic


  // environment specific config methods and options


  // list of packages need to be resolved later (they found a matching version in the
  // resolver, but better matches can still arrive later in the resolve process)


  /**
   * TODO description
   */

  isNewPattern(pattern) {
    return !!this.patterns[pattern].fresh;
  }

  updateManifest(ref, newPkg) {
    // inherit fields
    const oldPkg = this.patterns[ref.patterns[0]];
    newPkg._reference = ref;
    newPkg._remote = ref.remote;
    newPkg.name = oldPkg.name;
    newPkg.fresh = oldPkg.fresh;
    newPkg.prebuiltVariants = oldPkg.prebuiltVariants;

    // update patterns
    for (var _iterator = ref.patterns, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
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

      this.patterns[pattern] = newPkg;
    }

    return Promise.resolve();
  }

  updateManifests(newPkgs) {
    for (var _iterator2 = newPkgs, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref2;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref2 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref2 = _i2.value;
      }

      const newPkg = _ref2;

      if (newPkg._reference) {
        for (var _iterator3 = newPkg._reference.patterns, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
          var _ref3;

          if (_isArray3) {
            if (_i3 >= _iterator3.length) break;
            _ref3 = _iterator3[_i3++];
          } else {
            _i3 = _iterator3.next();
            if (_i3.done) break;
            _ref3 = _i3.value;
          }

          const pattern = _ref3;

          const oldPkg = this.patterns[pattern];
          newPkg.prebuiltVariants = oldPkg.prebuiltVariants;

          this.patterns[pattern] = newPkg;
        }
      }
    }

    return Promise.resolve();
  }

  /**
   * Given a list of patterns, dedupe them to a list of unique patterns.
   */

  dedupePatterns(patterns) {
    const deduped = [];
    const seen = new Set();

    for (var _iterator4 = patterns, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
      var _ref4;

      if (_isArray4) {
        if (_i4 >= _iterator4.length) break;
        _ref4 = _iterator4[_i4++];
      } else {
        _i4 = _iterator4.next();
        if (_i4.done) break;
        _ref4 = _i4.value;
      }

      const pattern = _ref4;

      const info = this.getResolvedPattern(pattern);
      if (seen.has(info)) {
        continue;
      }

      seen.add(info);
      deduped.push(pattern);
    }

    return deduped;
  }

  /**
   * Get a list of all manifests by topological order.
   */

  getTopologicalManifests(seedPatterns) {
    const pkgs = new Set();
    const skip = new Set();

    const add = seedPatterns => {
      for (var _iterator5 = seedPatterns, _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
        var _ref5;

        if (_isArray5) {
          if (_i5 >= _iterator5.length) break;
          _ref5 = _iterator5[_i5++];
        } else {
          _i5 = _iterator5.next();
          if (_i5.done) break;
          _ref5 = _i5.value;
        }

        const pattern = _ref5;

        const pkg = this.getStrictResolvedPattern(pattern);
        if (skip.has(pkg)) {
          continue;
        }

        const ref = pkg._reference;
        invariant(ref, 'expected reference');
        skip.add(pkg);
        add(ref.dependencies);
        pkgs.add(pkg);
      }
    };

    add(seedPatterns);

    return pkgs;
  }

  /**
   * Get a list of all manifests by level sort order.
   */

  getLevelOrderManifests(seedPatterns) {
    const pkgs = new Set();
    const skip = new Set();

    const add = seedPatterns => {
      const refs = [];

      for (var _iterator6 = seedPatterns, _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
        var _ref6;

        if (_isArray6) {
          if (_i6 >= _iterator6.length) break;
          _ref6 = _iterator6[_i6++];
        } else {
          _i6 = _iterator6.next();
          if (_i6.done) break;
          _ref6 = _i6.value;
        }

        const pattern = _ref6;

        const pkg = this.getStrictResolvedPattern(pattern);
        if (skip.has(pkg)) {
          continue;
        }

        const ref = pkg._reference;
        invariant(ref, 'expected reference');

        refs.push(ref);
        skip.add(pkg);
        pkgs.add(pkg);
      }

      for (var _iterator7 = refs, _isArray7 = Array.isArray(_iterator7), _i7 = 0, _iterator7 = _isArray7 ? _iterator7 : _iterator7[Symbol.iterator]();;) {
        var _ref7;

        if (_isArray7) {
          if (_i7 >= _iterator7.length) break;
          _ref7 = _iterator7[_i7++];
        } else {
          _i7 = _iterator7.next();
          if (_i7.done) break;
          _ref7 = _i7.value;
        }

        const ref = _ref7;

        add(ref.dependencies);
      }
    };

    add(seedPatterns);

    return pkgs;
  }

  /**
   * Get a list of all package names in the dependency graph.
   */

  getAllDependencyNamesByLevelOrder(seedPatterns) {
    const names = new Set();
    for (var _iterator8 = this.getLevelOrderManifests(seedPatterns), _isArray8 = Array.isArray(_iterator8), _i8 = 0, _iterator8 = _isArray8 ? _iterator8 : _iterator8[Symbol.iterator]();;) {
      var _ref9;

      if (_isArray8) {
        if (_i8 >= _iterator8.length) break;
        _ref9 = _iterator8[_i8++];
      } else {
        _i8 = _iterator8.next();
        if (_i8.done) break;
        _ref9 = _i8.value;
      }

      const _ref8 = _ref9;
      const name = _ref8.name;

      names.add(name);
    }
    return names;
  }

  /**
   * Retrieve all the package info stored for this package name.
   */

  getAllInfoForPackageName(name) {
    const patterns = this.patternsByPackage[name] || [];
    return this.getAllInfoForPatterns(patterns);
  }

  /**
   * Retrieve all the package info stored for a list of patterns.
   */

  getAllInfoForPatterns(patterns) {
    const infos = [];
    const seen = new Set();

    for (var _iterator9 = patterns, _isArray9 = Array.isArray(_iterator9), _i9 = 0, _iterator9 = _isArray9 ? _iterator9 : _iterator9[Symbol.iterator]();;) {
      var _ref10;

      if (_isArray9) {
        if (_i9 >= _iterator9.length) break;
        _ref10 = _iterator9[_i9++];
      } else {
        _i9 = _iterator9.next();
        if (_i9.done) break;
        _ref10 = _i9.value;
      }

      const pattern = _ref10;

      const info = this.patterns[pattern];
      if (seen.has(info)) {
        continue;
      }

      seen.add(info);
      infos.push(info);
    }

    return infos;
  }

  /**
   * Get a flat list of all package info.
   */

  getManifests() {
    const infos = [];
    const seen = new Set();

    for (const pattern in this.patterns) {
      const info = this.patterns[pattern];
      if (seen.has(info)) {
        continue;
      }

      infos.push(info);
      seen.add(info);
    }

    return infos;
  }

  /**
   * replace pattern in resolver, e.g. `name` is replaced with `name@^1.0.1`
   */
  replacePattern(pattern, newPattern) {
    const pkg = this.getResolvedPattern(pattern);
    invariant(pkg, `missing package ${pattern}`);
    const ref = pkg._reference;
    invariant(ref, 'expected package reference');
    ref.patterns = [newPattern];
    this.addPattern(newPattern, pkg);
    this.removePattern(pattern);
  }

  /**
   * Make all versions of this package resolve to it.
   */

  collapseAllVersionsOfPackage(name, version) {
    const patterns = this.dedupePatterns(this.patternsByPackage[name]);
    return this.collapsePackageVersions(name, version, patterns);
  }

  /**
   * Make all given patterns resolve to version.
   */
  collapsePackageVersions(name, version, patterns) {
    const human = `${name}@${version}`;

    // get manifest that matches the version we're collapsing too
    let collapseToReference;
    let collapseToManifest;
    let collapseToPattern;
    for (var _iterator10 = patterns, _isArray10 = Array.isArray(_iterator10), _i10 = 0, _iterator10 = _isArray10 ? _iterator10 : _iterator10[Symbol.iterator]();;) {
      var _ref11;

      if (_isArray10) {
        if (_i10 >= _iterator10.length) break;
        _ref11 = _iterator10[_i10++];
      } else {
        _i10 = _iterator10.next();
        if (_i10.done) break;
        _ref11 = _i10.value;
      }

      const pattern = _ref11;

      const _manifest = this.patterns[pattern];
      if (_manifest.version === version) {
        collapseToReference = _manifest._reference;
        collapseToManifest = _manifest;
        collapseToPattern = pattern;
        break;
      }
    }

    invariant(collapseToReference && collapseToManifest && collapseToPattern, `Couldn't find package manifest for ${human}`);

    for (var _iterator11 = patterns, _isArray11 = Array.isArray(_iterator11), _i11 = 0, _iterator11 = _isArray11 ? _iterator11 : _iterator11[Symbol.iterator]();;) {
      var _ref12;

      if (_isArray11) {
        if (_i11 >= _iterator11.length) break;
        _ref12 = _iterator11[_i11++];
      } else {
        _i11 = _iterator11.next();
        if (_i11.done) break;
        _ref12 = _i11.value;
      }

      const pattern = _ref12;

      // don't touch the pattern we're collapsing to
      if (pattern === collapseToPattern) {
        continue;
      }

      // remove this pattern
      const ref = this.getStrictResolvedPattern(pattern)._reference;
      invariant(ref, 'expected package reference');
      const refPatterns = ref.patterns.slice();
      ref.prune();

      // add pattern to the manifest we're collapsing to
      for (var _iterator12 = refPatterns, _isArray12 = Array.isArray(_iterator12), _i12 = 0, _iterator12 = _isArray12 ? _iterator12 : _iterator12[Symbol.iterator]();;) {
        var _ref13;

        if (_isArray12) {
          if (_i12 >= _iterator12.length) break;
          _ref13 = _iterator12[_i12++];
        } else {
          _i12 = _iterator12.next();
          if (_i12.done) break;
          _ref13 = _i12.value;
        }

        const pattern = _ref13;

        collapseToReference.addPattern(pattern, collapseToManifest);
      }
    }

    return collapseToPattern;
  }

  /**
   * TODO description
   */

  addPattern(pattern, info) {
    this.patterns[pattern] = info;

    const byName = this.patternsByPackage[info.name] = this.patternsByPackage[info.name] || [];
    if (byName.indexOf(pattern) === -1) {
      byName.push(pattern);
    }
  }

  /**
   * TODO description
   */

  removePattern(pattern) {
    const pkg = this.patterns[pattern];
    if (!pkg) {
      return;
    }

    const byName = this.patternsByPackage[pkg.name];
    if (!byName) {
      return;
    }

    byName.splice(byName.indexOf(pattern), 1);
    delete this.patterns[pattern];
  }

  /**
   * TODO description
   */

  getResolvedPattern(pattern) {
    return this.patterns[pattern];
  }

  /**
   * TODO description
   */

  getStrictResolvedPattern(pattern) {
    const manifest = this.getResolvedPattern(pattern);
    invariant(manifest, 'expected manifest');
    return manifest;
  }

  /**
   * TODO description
   */

  getExactVersionMatch(name, version, manifest) {
    const patterns = this.patternsByPackage[name];
    if (!patterns) {
      return null;
    }

    for (var _iterator13 = patterns, _isArray13 = Array.isArray(_iterator13), _i13 = 0, _iterator13 = _isArray13 ? _iterator13 : _iterator13[Symbol.iterator]();;) {
      var _ref14;

      if (_isArray13) {
        if (_i13 >= _iterator13.length) break;
        _ref14 = _iterator13[_i13++];
      } else {
        _i13 = _iterator13.next();
        if (_i13.done) break;
        _ref14 = _i13.value;
      }

      const pattern = _ref14;

      const info = this.getStrictResolvedPattern(pattern);
      if (info.version === version) {
        return info;
      }
    }

    if (manifest && (0, (_index || _load_index()).getExoticResolver)(version)) {
      return this.exoticRangeMatch(patterns.map(this.getStrictResolvedPattern.bind(this)), manifest);
    }

    return null;
  }

  /**
   * Get the manifest of the highest known version that satisfies a package range
   */

  getHighestRangeVersionMatch(name, range, manifest) {
    const patterns = this.patternsByPackage[name];

    if (!patterns) {
      return null;
    }

    const versionNumbers = [];
    const resolvedPatterns = patterns.map(pattern => {
      const info = this.getStrictResolvedPattern(pattern);
      versionNumbers.push(info.version);

      return info;
    });

    const maxValidRange = semver.maxSatisfying(versionNumbers, range);

    if (!maxValidRange) {
      return manifest && (0, (_index || _load_index()).getExoticResolver)(range) ? this.exoticRangeMatch(resolvedPatterns, manifest) : null;
    }

    const indexOfmaxValidRange = versionNumbers.indexOf(maxValidRange);
    const maxValidRangeManifest = resolvedPatterns[indexOfmaxValidRange];

    return maxValidRangeManifest;
  }

  /**
   * Get the manifest of the package that matches an exotic range
   */

  exoticRangeMatch(resolvedPkgs, manifest) {
    const remote = manifest._remote;
    if (!(remote && remote.reference && remote.type === 'copy')) {
      return null;
    }

    const matchedPkg = resolvedPkgs.find(({ _remote: pkgRemote }) => pkgRemote && pkgRemote.reference === remote.reference && pkgRemote.type === 'copy');

    if (matchedPkg) {
      manifest._remote = matchedPkg._remote;
    }

    return matchedPkg;
  }

  /**
   * Determine if LockfileEntry is incorrect, remove it from lockfile cache and consider the pattern as new
   */
  isLockfileEntryOutdated(version, range, hasVersion) {
    return !!(semver.validRange(range) && semver.valid(version) && !(0, (_index || _load_index()).getExoticResolver)(range) && hasVersion && !semver.satisfies(version, range));
  }

  /**
   * TODO description
   */

  find(initialReq) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const req = _this.resolveToResolution(initialReq);

      // we've already resolved it with a resolution
      if (!req) {
        return;
      }

      const request = new (_packageRequest || _load_packageRequest()).default(req, _this);
      const fetchKey = `${req.registry}:${req.pattern}:${String(req.optional)}`;
      const initialFetch = !_this.fetchingPatterns.has(fetchKey);
      let fresh = false;

      if (_this.activity) {
        _this.activity.tick(req.pattern);
      }

      if (initialFetch) {
        _this.fetchingPatterns.add(fetchKey);

        const lockfileEntry = _this.lockfile.getLocked(req.pattern);

        if (lockfileEntry) {
          var _normalizePattern = (0, (_normalizePattern2 || _load_normalizePattern()).normalizePattern)(req.pattern);

          const range = _normalizePattern.range,
                hasVersion = _normalizePattern.hasVersion;


          if (_this.isLockfileEntryOutdated(lockfileEntry.version, range, hasVersion)) {
            _this.reporter.warn(_this.reporter.lang('incorrectLockfileEntry', req.pattern));
            _this.removePattern(req.pattern);
            _this.lockfile.removePattern(req.pattern);
            fresh = true;
          }
        } else {
          fresh = true;
        }

        request.init();
      }

      yield request.find({ fresh, frozen: _this.frozen });
    })();
  }

  /**
   * TODO description
   */

  init(deps, { isFlat, isFrozen, workspaceLayout } = {
    isFlat: false,
    isFrozen: false,
    workspaceLayout: undefined
  }) {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      _this2.flat = Boolean(isFlat);
      _this2.frozen = Boolean(isFrozen);
      _this2.workspaceLayout = workspaceLayout;
      const activity = _this2.activity = _this2.reporter.activity();

      for (var _iterator14 = deps, _isArray14 = Array.isArray(_iterator14), _i14 = 0, _iterator14 = _isArray14 ? _iterator14 : _iterator14[Symbol.iterator]();;) {
        var _ref15;

        if (_isArray14) {
          if (_i14 >= _iterator14.length) break;
          _ref15 = _iterator14[_i14++];
        } else {
          _i14 = _iterator14.next();
          if (_i14.done) break;
          _ref15 = _i14.value;
        }

        const req = _ref15;

        yield _this2.find(req);
      }

      // all required package versions have been discovered, so now packages that
      // resolved to existing versions can be resolved to their best available version
      _this2.resolvePackagesWithExistingVersions();

      for (var _iterator15 = _this2.resolutionMap.delayQueue, _isArray15 = Array.isArray(_iterator15), _i15 = 0, _iterator15 = _isArray15 ? _iterator15 : _iterator15[Symbol.iterator]();;) {
        var _ref16;

        if (_isArray15) {
          if (_i15 >= _iterator15.length) break;
          _ref16 = _iterator15[_i15++];
        } else {
          _i15 = _iterator15.next();
          if (_i15.done) break;
          _ref16 = _i15.value;
        }

        const req = _ref16;

        _this2.resolveToResolution(req);
      }

      if (isFlat) {
        for (var _iterator16 = deps, _isArray16 = Array.isArray(_iterator16), _i16 = 0, _iterator16 = _isArray16 ? _iterator16 : _iterator16[Symbol.iterator]();;) {
          var _ref17;

          if (_isArray16) {
            if (_i16 >= _iterator16.length) break;
            _ref17 = _iterator16[_i16++];
          } else {
            _i16 = _iterator16.next();
            if (_i16.done) break;
            _ref17 = _i16.value;
          }

          const dep = _ref17;

          const name = (0, (_normalizePattern2 || _load_normalizePattern()).normalizePattern)(dep.pattern).name;
          _this2.optimizeResolutions(name);
        }
      }

      activity.end();
      _this2.activity = null;
    })();
  }

  // for a given package, see if a single manifest can satisfy all ranges
  optimizeResolutions(name) {
    const patterns = this.dedupePatterns(this.patternsByPackage[name] || []);

    // don't optimize things that already have a lockfile entry:
    // https://github.com/yarnpkg/yarn/issues/79
    const collapsablePatterns = patterns.filter(pattern => {
      const remote = this.patterns[pattern]._remote;
      return !this.lockfile.getLocked(pattern) && (!remote || remote.type !== 'workspace');
    });
    if (collapsablePatterns.length < 2) {
      return;
    }

    // reverse sort, so we'll find the maximum satisfying version first
    const availableVersions = this.getAllInfoForPatterns(collapsablePatterns).map(manifest => manifest.version);
    availableVersions.sort(semver.rcompare);

    const ranges = collapsablePatterns.map(pattern => (0, (_normalizePattern2 || _load_normalizePattern()).normalizePattern)(pattern).range);

    // find the most recent version that satisfies all patterns (if one exists), and
    // collapse to that version.
    for (var _iterator17 = availableVersions, _isArray17 = Array.isArray(_iterator17), _i17 = 0, _iterator17 = _isArray17 ? _iterator17 : _iterator17[Symbol.iterator]();;) {
      var _ref18;

      if (_isArray17) {
        if (_i17 >= _iterator17.length) break;
        _ref18 = _iterator17[_i17++];
      } else {
        _i17 = _iterator17.next();
        if (_i17.done) break;
        _ref18 = _i17.value;
      }

      const version = _ref18;

      if (ranges.every(range => semver.satisfies(version, range))) {
        this.collapsePackageVersions(name, version, collapsablePatterns);
        return;
      }
    }
  }

  /**
    * Called by the package requester for packages that this resolver already had
    * a matching version for. Delay the resolve, because better matches can still be
    * discovered.
    */

  reportPackageWithExistingVersion(req, info) {
    this.delayedResolveQueue.push({ req, info });
  }

  /**
    * Executes the resolve to existing versions for packages after the find process,
    * when all versions that are going to be used have been discovered.
    */

  resolvePackagesWithExistingVersions() {
    for (var _iterator18 = this.delayedResolveQueue, _isArray18 = Array.isArray(_iterator18), _i18 = 0, _iterator18 = _isArray18 ? _iterator18 : _iterator18[Symbol.iterator]();;) {
      var _ref20;

      if (_isArray18) {
        if (_i18 >= _iterator18.length) break;
        _ref20 = _iterator18[_i18++];
      } else {
        _i18 = _iterator18.next();
        if (_i18.done) break;
        _ref20 = _i18.value;
      }

      const _ref19 = _ref20;
      const req = _ref19.req,
            info = _ref19.info;

      req.resolveToExistingVersion(info);
    }
  }

  resolveToResolution(req) {
    const parentNames = req.parentNames,
          pattern = req.pattern;


    if (!parentNames || this.flat) {
      return req;
    }

    const resolution = this.resolutionMap.find(pattern, parentNames);

    if (resolution) {
      const resolutionManifest = this.getResolvedPattern(resolution);

      if (resolutionManifest) {
        invariant(resolutionManifest._reference, 'resolutions should have a resolved reference');
        resolutionManifest._reference.patterns.push(pattern);
        this.addPattern(pattern, resolutionManifest);
        const lockManifest = this.lockfile.getLocked(pattern);
        if ((0, (_resolutionMap2 || _load_resolutionMap2()).shouldUpdateLockfile)(lockManifest, resolutionManifest._reference)) {
          this.lockfile.removePattern(pattern);
        }
      } else {
        this.resolutionMap.addToDelayQueue(req);
      }
      return null;
    }

    return req;
  }
}
exports.default = PackageResolver;
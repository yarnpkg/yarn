'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _path;

function _load_path() {
  return _path = _interopRequireDefault(require('path'));
}

var _invariant;

function _load_invariant() {
  return _invariant = _interopRequireDefault(require('invariant'));
}

var _semver;

function _load_semver() {
  return _semver = _interopRequireDefault(require('semver'));
}

var _validate;

function _load_validate() {
  return _validate = require('./util/normalize-manifest/validate.js');
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('./lockfile'));
}

var _packageReference;

function _load_packageReference() {
  return _packageReference = _interopRequireDefault(require('./package-reference.js'));
}

var _index;

function _load_index() {
  return _index = require('./resolvers/index.js');
}

var _errors;

function _load_errors() {
  return _errors = require('./errors.js');
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('./constants.js'));
}

var _version;

function _load_version() {
  return _version = _interopRequireWildcard(require('./util/version.js'));
}

var _workspaceResolver;

function _load_workspaceResolver() {
  return _workspaceResolver = _interopRequireDefault(require('./resolvers/contextual/workspace-resolver.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('./util/fs.js'));
}

var _normalizePattern4;

function _load_normalizePattern() {
  return _normalizePattern4 = require('./util/normalize-pattern.js');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const micromatch = require('micromatch');

class PackageRequest {
  constructor(req, resolver) {
    this.parentRequest = req.parentRequest;
    this.parentNames = req.parentNames || [];
    this.lockfile = resolver.lockfile;
    this.registry = req.registry;
    this.reporter = resolver.reporter;
    this.resolver = resolver;
    this.optional = req.optional;
    this.hint = req.hint;
    this.pattern = req.pattern;
    this.config = resolver.config;
    this.foundInfo = null;
  }

  init() {
    this.resolver.usedRegistries.add(this.registry);
  }

  getLocked(remoteType) {
    // always prioritise root lockfile
    const shrunk = this.lockfile.getLocked(this.pattern);

    if (shrunk && shrunk.resolved) {
      const resolvedParts = (_version || _load_version()).explodeHashedUrl(shrunk.resolved);

      // Detect Git protocols (git://HOST/PATH or git+PROTOCOL://HOST/PATH)
      const preferredRemoteType = /^git(\+[a-z0-9]+)?:\/\//.test(resolvedParts.url) ? 'git' : remoteType;

      return {
        name: shrunk.name,
        version: shrunk.version,
        _uid: shrunk.uid,
        _remote: {
          resolved: shrunk.resolved,
          type: preferredRemoteType,
          reference: resolvedParts.url,
          hash: resolvedParts.hash,
          integrity: shrunk.integrity,
          registry: shrunk.registry,
          packageName: shrunk.name
        },
        optionalDependencies: shrunk.optionalDependencies || {},
        dependencies: shrunk.dependencies || {},
        prebuiltVariants: shrunk.prebuiltVariants || {}
      };
    } else {
      return null;
    }
  }

  /**
   * If the input pattern matches a registry one then attempt to find it on the registry.
   * Otherwise fork off to an exotic resolver if one matches.
   */

  findVersionOnRegistry(pattern) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      var _ref = yield _this.normalize(pattern);

      const range = _ref.range,
            name = _ref.name;


      const exoticResolver = (0, (_index || _load_index()).getExoticResolver)(range);
      if (exoticResolver) {
        let data = yield _this.findExoticVersionInfo(exoticResolver, range);

        // clone data as we're manipulating it in place and this could be resolved multiple
        // times
        data = Object.assign({}, data);

        // this is so the returned package response uses the overridden name. ie. if the
        // package's actual name is `bar`, but it's been specified in the manifest like:
        //   "foo": "http://foo.com/bar.tar.gz"
        // then we use the foo name
        data.name = name;
        return data;
      }

      const Resolver = _this.getRegistryResolver();
      const resolver = new Resolver(_this, name, range);
      try {
        return yield resolver.resolve();
      } catch (err) {
        // if it is not an error thrown by yarn and it has a parent request,
        // thow a more readable error
        if (!(err instanceof (_errors || _load_errors()).MessageError) && _this.parentRequest && _this.parentRequest.pattern) {
          throw new (_errors || _load_errors()).MessageError(_this.reporter.lang('requiredPackageNotFoundRegistry', pattern, _this.parentRequest.pattern, _this.registry));
        }
        throw err;
      }
    })();
  }

  /**
   * Get the registry resolver associated with this package request.
   */

  getRegistryResolver() {
    const Resolver = (_index || _load_index()).registries[this.registry];
    if (Resolver) {
      return Resolver;
    } else {
      throw new (_errors || _load_errors()).MessageError(this.reporter.lang('unknownRegistryResolver', this.registry));
    }
  }

  normalizeRange(pattern) {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      if (pattern.indexOf(':') > -1 || pattern.indexOf('@') > -1 || (0, (_index || _load_index()).getExoticResolver)(pattern)) {
        return pattern;
      }

      if (!(_semver || _load_semver()).default.validRange(pattern)) {
        try {
          if (yield (_fs || _load_fs()).exists((_path || _load_path()).default.join(_this2.config.cwd, pattern, (_constants || _load_constants()).NODE_PACKAGE_JSON))) {
            _this2.reporter.warn(_this2.reporter.lang('implicitFileDeprecated', pattern));
            return `file:${pattern}`;
          }
        } catch (err) {
          // pass
        }
      }

      return pattern;
    })();
  }

  normalize(pattern) {
    var _this3 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      var _normalizePattern = (0, (_normalizePattern4 || _load_normalizePattern()).normalizePattern)(pattern);

      const name = _normalizePattern.name,
            range = _normalizePattern.range,
            hasVersion = _normalizePattern.hasVersion;

      const newRange = yield _this3.normalizeRange(range);
      return { name, range: newRange, hasVersion };
    })();
  }

  /**
   * Construct an exotic resolver instance with the input `ExoticResolver` and `range`.
   */

  findExoticVersionInfo(ExoticResolver, range) {
    const resolver = new ExoticResolver(this, range);
    return resolver.resolve();
  }

  /**
   * If the current pattern matches an exotic resolver then delegate to it or else try
   * the registry.
   */

  findVersionInfo() {
    var _this4 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const exoticResolver = (0, (_index || _load_index()).getExoticResolver)(_this4.pattern);
      if (exoticResolver) {
        return _this4.findExoticVersionInfo(exoticResolver, _this4.pattern);
      } else if ((_workspaceResolver || _load_workspaceResolver()).default.isWorkspace(_this4.pattern, _this4.resolver.workspaceLayout)) {
        (0, (_invariant || _load_invariant()).default)(_this4.resolver.workspaceLayout, 'expected workspaceLayout');
        const resolver = new (_workspaceResolver || _load_workspaceResolver()).default(_this4, _this4.pattern, _this4.resolver.workspaceLayout);
        let manifest;
        if (_this4.config.focus && !_this4.pattern.includes(_this4.resolver.workspaceLayout.virtualManifestName) && !_this4.pattern.startsWith(_this4.config.focusedWorkspaceName + '@')) {
          const localInfo = _this4.resolver.workspaceLayout.getManifestByPattern(_this4.pattern);
          (0, (_invariant || _load_invariant()).default)(localInfo, 'expected local info for ' + _this4.pattern);
          const localManifest = localInfo.manifest;
          const requestPattern = localManifest.name + '@' + localManifest.version;
          manifest = yield _this4.findVersionOnRegistry(requestPattern);
        }
        return resolver.resolve(manifest);
      } else {
        return _this4.findVersionOnRegistry(_this4.pattern);
      }
    })();
  }

  reportResolvedRangeMatch(info, resolved) {}

  /**
   * Do the final resolve of a package that had a match with an existing version.
   * After all unique versions have been discovered, so the best available version
   * is found.
   */
  resolveToExistingVersion(info) {
    // get final resolved version
    var _normalizePattern2 = (0, (_normalizePattern4 || _load_normalizePattern()).normalizePattern)(this.pattern);

    const range = _normalizePattern2.range,
          name = _normalizePattern2.name;

    const solvedRange = (_semver || _load_semver()).default.validRange(range) ? info.version : range;
    const resolved = this.resolver.getHighestRangeVersionMatch(name, solvedRange, info);
    (0, (_invariant || _load_invariant()).default)(resolved, 'should have a resolved reference');

    this.reportResolvedRangeMatch(info, resolved);
    const ref = resolved._reference;
    (0, (_invariant || _load_invariant()).default)(ref, 'Resolved package info has no package reference');
    ref.addRequest(this);
    ref.addPattern(this.pattern, resolved);
    ref.addOptional(this.optional);
  }

  /**
   * TODO description
   */
  find({ fresh, frozen }) {
    var _this5 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      // find version info for this package pattern
      const info = yield _this5.findVersionInfo();

      if (!(_semver || _load_semver()).default.valid(info.version)) {
        throw new (_errors || _load_errors()).MessageError(_this5.reporter.lang('invalidPackageVersion', info.name, info.version));
      }

      info.fresh = fresh;
      (0, (_validate || _load_validate()).cleanDependencies)(info, false, _this5.reporter, function () {
        // swallow warnings
      });

      // check if while we were resolving this dep we've already resolved one that satisfies
      // the same range

      var _normalizePattern3 = (0, (_normalizePattern4 || _load_normalizePattern()).normalizePattern)(_this5.pattern);

      const range = _normalizePattern3.range,
            name = _normalizePattern3.name;

      const solvedRange = (_semver || _load_semver()).default.validRange(range) ? info.version : range;
      const resolved = !info.fresh || frozen ? _this5.resolver.getExactVersionMatch(name, solvedRange, info) : _this5.resolver.getHighestRangeVersionMatch(name, solvedRange, info);

      if (resolved) {
        _this5.resolver.reportPackageWithExistingVersion(_this5, info);
        return;
      }

      if (info.flat && !_this5.resolver.flat) {
        throw new (_errors || _load_errors()).MessageError(_this5.reporter.lang('flatGlobalError', `${info.name}@${info.version}`));
      }

      // validate version info
      PackageRequest.validateVersionInfo(info, _this5.reporter);

      //
      const remote = info._remote;
      (0, (_invariant || _load_invariant()).default)(remote, 'Missing remote');

      // set package reference
      const ref = new (_packageReference || _load_packageReference()).default(_this5, info, remote);
      ref.addPattern(_this5.pattern, info);
      ref.addOptional(_this5.optional);
      ref.setFresh(fresh);
      info._reference = ref;
      info._remote = remote;
      // start installation of dependencies
      const promises = [];
      const deps = [];
      const parentNames = [..._this5.parentNames, name];
      // normal deps
      for (const depName in info.dependencies) {
        const depPattern = depName + '@' + info.dependencies[depName];
        deps.push(depPattern);
        promises.push(_this5.resolver.find({
          pattern: depPattern,
          registry: remote.registry,
          // dependencies of optional dependencies should themselves be optional
          optional: _this5.optional,
          parentRequest: _this5,
          parentNames
        }));
      }

      // optional deps
      for (const depName in info.optionalDependencies) {
        const depPattern = depName + '@' + info.optionalDependencies[depName];
        deps.push(depPattern);
        promises.push(_this5.resolver.find({
          hint: 'optional',
          pattern: depPattern,
          registry: remote.registry,
          optional: true,
          parentRequest: _this5,
          parentNames
        }));
      }
      if (remote.type === 'workspace' && !_this5.config.production) {
        // workspaces support dev dependencies
        for (const depName in info.devDependencies) {
          const depPattern = depName + '@' + info.devDependencies[depName];
          deps.push(depPattern);
          promises.push(_this5.resolver.find({
            hint: 'dev',
            pattern: depPattern,
            registry: remote.registry,
            optional: false,
            parentRequest: _this5,
            parentNames
          }));
        }
      }

      for (var _iterator = promises, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref2;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref2 = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref2 = _i.value;
        }

        const promise = _ref2;

        yield promise;
      }

      ref.addDependencies(deps);

      // Now that we have all dependencies, it's safe to propagate optional
      for (var _iterator2 = ref.requests.slice(1), _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref3;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref3 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref3 = _i2.value;
        }

        const otherRequest = _ref3;

        ref.addOptional(otherRequest.optional);
      }
    })();
  }

  /**
   * TODO description
   */

  static validateVersionInfo(info, reporter) {
    // human readable name to use in errors
    const human = `${info.name}@${info.version}`;

    info.version = PackageRequest.getPackageVersion(info);

    for (var _iterator3 = (_constants || _load_constants()).REQUIRED_PACKAGE_KEYS, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
      var _ref4;

      if (_isArray3) {
        if (_i3 >= _iterator3.length) break;
        _ref4 = _iterator3[_i3++];
      } else {
        _i3 = _iterator3.next();
        if (_i3.done) break;
        _ref4 = _i3.value;
      }

      const key = _ref4;

      if (!info[key]) {
        throw new (_errors || _load_errors()).MessageError(reporter.lang('missingRequiredPackageKey', human, key));
      }
    }
  }

  /**
   * Returns the package version if present, else defaults to the uid
   */

  static getPackageVersion(info) {
    // TODO possibly reconsider this behaviour
    return info.version === undefined ? info._uid : info.version;
  }

  /**
   * Gets all of the outdated packages and sorts them appropriately
   */

  static getOutdatedPackages(lockfile, install, config, reporter, filterByPatterns, flags) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      var _ref5 = yield install.fetchRequestFromCwd();

      const reqPatterns = _ref5.requests,
            workspaceLayout = _ref5.workspaceLayout;

      // Filter out workspace patterns if necessary

      let depReqPatterns = workspaceLayout ? reqPatterns.filter(function (p) {
        return !workspaceLayout.getManifestByPattern(p.pattern);
      }) : reqPatterns;

      // filter the list down to just the packages requested.
      // prevents us from having to query the metadata for all packages.
      if (filterByPatterns && filterByPatterns.length || flags && flags.pattern) {
        const filterByNames = filterByPatterns && filterByPatterns.length ? filterByPatterns.map(function (pattern) {
          return (0, (_normalizePattern4 || _load_normalizePattern()).normalizePattern)(pattern).name;
        }) : [];
        depReqPatterns = depReqPatterns.filter(function (dep) {
          return filterByNames.indexOf((0, (_normalizePattern4 || _load_normalizePattern()).normalizePattern)(dep.pattern).name) >= 0 || flags && flags.pattern && micromatch.contains((0, (_normalizePattern4 || _load_normalizePattern()).normalizePattern)(dep.pattern).name, flags.pattern);
        });
      }

      const deps = yield Promise.all(depReqPatterns.map((() => {
        var _ref6 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* ({ pattern, hint, workspaceName, workspaceLoc }) {
          const locked = lockfile.getLocked(pattern);
          if (!locked) {
            throw new (_errors || _load_errors()).MessageError(reporter.lang('lockfileOutdated'));
          }

          const name = locked.name,
                current = locked.version;

          let latest = '';
          let wanted = '';
          let url = '';

          const normalized = (0, (_normalizePattern4 || _load_normalizePattern()).normalizePattern)(pattern);

          if ((0, (_index || _load_index()).getExoticResolver)(pattern) || (0, (_index || _load_index()).getExoticResolver)(normalized.range)) {
            latest = wanted = 'exotic';
            url = normalized.range;
          } else {
            const registry = config.registries[locked.registry];

            var _ref7 = yield registry.checkOutdated(config, name, normalized.range);

            latest = _ref7.latest;
            wanted = _ref7.wanted;
            url = _ref7.url;
          }

          return {
            name,
            current,
            wanted,
            latest,
            url,
            hint,
            range: normalized.range,
            upgradeTo: '',
            workspaceName: workspaceName || '',
            workspaceLoc: workspaceLoc || ''
          };
        });

        return function (_x) {
          return _ref6.apply(this, arguments);
        };
      })()));

      // Make sure to always output `exotic` versions to be compatible with npm
      const isDepOld = function isDepOld({ current, latest, wanted }) {
        return latest === 'exotic' || (_semver || _load_semver()).default.lt(current, wanted) || (_semver || _load_semver()).default.lt(current, latest);
      };
      const orderByName = function orderByName(depA, depB) {
        return depA.name.localeCompare(depB.name);
      };
      return deps.filter(isDepOld).sort(orderByName);
    })();
  }
}
exports.default = PackageRequest;
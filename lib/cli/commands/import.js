'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.Import = exports.noArguments = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let run = exports.run = (() => {
  var _ref5 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    const imp = new Import(flags, config, reporter, new (_lockfile || _load_lockfile()).default({ cache: {} }));
    yield imp.init();
  });

  return function run(_x, _x2, _x3, _x4) {
    return _ref5.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _install;

function _load_install() {
  return _install = require('./install.js');
}

var _check;

function _load_check() {
  return _check = require('./check.js');
}

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _index;

function _load_index() {
  return _index = require('../../resolvers/index.js');
}

var _baseResolver;

function _load_baseResolver() {
  return _baseResolver = _interopRequireDefault(require('../../resolvers/base-resolver.js'));
}

var _hostedGitResolver;

function _load_hostedGitResolver() {
  return _hostedGitResolver = _interopRequireDefault(require('../../resolvers/exotics/hosted-git-resolver.js'));
}

var _hostedGitResolver2;

function _load_hostedGitResolver2() {
  return _hostedGitResolver2 = require('../../resolvers/exotics/hosted-git-resolver.js');
}

var _gistResolver;

function _load_gistResolver() {
  return _gistResolver = _interopRequireDefault(require('../../resolvers/exotics/gist-resolver.js'));
}

var _gistResolver2;

function _load_gistResolver2() {
  return _gistResolver2 = require('../../resolvers/exotics/gist-resolver.js');
}

var _gitResolver;

function _load_gitResolver() {
  return _gitResolver = _interopRequireDefault(require('../../resolvers/exotics/git-resolver.js'));
}

var _fileResolver;

function _load_fileResolver() {
  return _fileResolver = _interopRequireDefault(require('../../resolvers/exotics/file-resolver.js'));
}

var _packageResolver;

function _load_packageResolver() {
  return _packageResolver = _interopRequireDefault(require('../../package-resolver.js'));
}

var _packageRequest;

function _load_packageRequest() {
  return _packageRequest = _interopRequireDefault(require('../../package-request.js'));
}

var _packageReference;

function _load_packageReference() {
  return _packageReference = _interopRequireDefault(require('../../package-reference.js'));
}

var _packageFetcher;

function _load_packageFetcher() {
  return _packageFetcher = _interopRequireWildcard(require('../../package-fetcher.js'));
}

var _packageLinker;

function _load_packageLinker() {
  return _packageLinker = _interopRequireDefault(require('../../package-linker.js'));
}

var _packageCompatibility;

function _load_packageCompatibility() {
  return _packageCompatibility = _interopRequireWildcard(require('../../package-compatibility.js'));
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../../lockfile'));
}

var _normalizePattern9;

function _load_normalizePattern() {
  return _normalizePattern9 = require('../../util/normalize-pattern.js');
}

var _logicalDependencyTree;

function _load_logicalDependencyTree() {
  return _logicalDependencyTree = require('../../util/logical-dependency-tree');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _misc;

function _load_misc() {
  return _misc = _interopRequireWildcard(require('../../util/misc.js'));
}

var _constants;

function _load_constants() {
  return _constants = require('../../constants.js');
}

var _semver;

function _load_semver() {
  return _semver = _interopRequireDefault(require('semver'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');
const path = require('path');
const uuid = require('uuid');
const ssri = require('ssri');
const nodeVersion = process.versions.node.split('-')[0];

const noArguments = exports.noArguments = true;

class ImportResolver extends (_baseResolver || _load_baseResolver()).default {
  getCwd() {
    if (this.request.parentRequest) {
      const parent = this.resolver.getStrictResolvedPattern(this.request.parentRequest.pattern);
      invariant(parent._loc, 'expected package location');
      return path.dirname(parent._loc);
    }
    return this.config.cwd;
  }

  resolveHostedGit(info, Resolver) {
    var _normalizePattern = (0, (_normalizePattern9 || _load_normalizePattern()).normalizePattern)(this.pattern);

    const range = _normalizePattern.range;

    const exploded = (0, (_hostedGitResolver2 || _load_hostedGitResolver2()).explodeHostedGitFragment)(range, this.reporter);
    const hash = info.gitHead;
    invariant(hash, 'expected package gitHead');
    const url = Resolver.getTarballUrl(exploded, hash);
    info._uid = hash;
    info._remote = {
      resolved: url,
      type: 'tarball',
      registry: this.registry,
      reference: url,
      hash: null
    };
    return info;
  }

  resolveGist(info, Resolver) {
    var _normalizePattern2 = (0, (_normalizePattern9 || _load_normalizePattern()).normalizePattern)(this.pattern);

    const range = _normalizePattern2.range;

    var _explodeGistFragment = (0, (_gistResolver2 || _load_gistResolver2()).explodeGistFragment)(range, this.reporter);

    const id = _explodeGistFragment.id;

    const hash = info.gitHead;
    invariant(hash, 'expected package gitHead');
    const url = `https://gist.github.com/${id}.git`;
    info._uid = hash;
    info._remote = {
      resolved: `${url}#${hash}`,
      type: 'git',
      registry: this.registry,
      reference: url,
      hash
    };
    return info;
  }

  resolveGit(info, Resolver) {
    const url = info._resolved;
    const hash = info.gitHead;
    invariant(url, 'expected package _resolved');
    invariant(hash, 'expected package gitHead');
    info._uid = hash;
    info._remote = {
      resolved: `${url}#${hash}`,
      type: 'git',
      registry: this.registry,
      reference: url,
      hash
    };
    return info;
  }

  resolveFile(info, Resolver) {
    var _normalizePattern3 = (0, (_normalizePattern9 || _load_normalizePattern()).normalizePattern)(this.pattern);

    const range = _normalizePattern3.range;

    let loc = (_misc || _load_misc()).removePrefix(range, 'file:');
    if (!path.isAbsolute(loc)) {
      loc = path.join(this.config.cwd, loc);
    }
    info._uid = info.version;
    info._remote = {
      type: 'copy',
      registry: this.registry,
      hash: `${uuid.v4()}-${new Date().getTime()}`,
      reference: loc
    };
    return info;
  }

  resolveRegistry(info) {
    let url = info._resolved;
    const hash = info._shasum;
    invariant(url, 'expected package _resolved');
    invariant(hash, 'expected package _shasum');
    if (this.config.getOption('registry') === (_constants || _load_constants()).YARN_REGISTRY) {
      url = url.replace((_constants || _load_constants()).NPM_REGISTRY_RE, (_constants || _load_constants()).YARN_REGISTRY);
    }
    info._uid = info.version;
    info._remote = {
      resolved: `${url}#${hash}`,
      type: 'tarball',
      registry: this.registry,
      reference: url,
      integrity: info._integrity ? ssri.parse(info._integrity) : ssri.fromHex(hash, 'sha1'),
      hash
    };
    return info;
  }

  resolveImport(info) {
    var _normalizePattern4 = (0, (_normalizePattern9 || _load_normalizePattern()).normalizePattern)(this.pattern);

    const range = _normalizePattern4.range;

    const Resolver = (0, (_index || _load_index()).getExoticResolver)(range);
    if (Resolver && Resolver.prototype instanceof (_hostedGitResolver || _load_hostedGitResolver()).default) {
      return this.resolveHostedGit(info, Resolver);
    } else if (Resolver && Resolver === (_gistResolver || _load_gistResolver()).default) {
      return this.resolveGist(info, Resolver);
    } else if (Resolver && Resolver === (_gitResolver || _load_gitResolver()).default) {
      return this.resolveGit(info, Resolver);
    } else if (Resolver && Resolver === (_fileResolver || _load_fileResolver()).default) {
      return this.resolveFile(info, Resolver);
    }
    return this.resolveRegistry(info);
  }

  resolveLocation(loc) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const info = yield _this.config.tryManifest(loc, 'npm', false);
      if (!info) {
        return null;
      }
      return _this.resolveImport(info);
    })();
  }

  resolveFixedVersion(fixedVersionPattern) {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      var _normalizePattern5 = (0, (_normalizePattern9 || _load_normalizePattern()).normalizePattern)(fixedVersionPattern);

      const range = _normalizePattern5.range;

      const exoticResolver = (0, (_index || _load_index()).getExoticResolver)(range);
      const manifest = exoticResolver ? yield _this2.request.findExoticVersionInfo(exoticResolver, range) : yield _this2.request.findVersionOnRegistry(fixedVersionPattern);
      return manifest;
    })();
  }

  _resolveFromFixedVersions() {
    var _this3 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      invariant(_this3.request instanceof ImportPackageRequest, 'request must be ImportPackageRequest');

      var _normalizePattern6 = (0, (_normalizePattern9 || _load_normalizePattern()).normalizePattern)(_this3.pattern);

      const name = _normalizePattern6.name;

      invariant(_this3.request.dependencyTree instanceof (_logicalDependencyTree || _load_logicalDependencyTree()).LogicalDependencyTree, 'dependencyTree on request must be LogicalDependencyTree');
      const fixedVersionPattern = _this3.request.dependencyTree.getFixedVersionPattern(name, _this3.request.parentNames);
      const info = yield _this3.config.getCache(`import-resolver-${fixedVersionPattern}`, function () {
        return _this3.resolveFixedVersion(fixedVersionPattern);
      });
      if (info) {
        return info;
      }
      throw new (_errors || _load_errors()).MessageError(_this3.reporter.lang('importResolveFailed', name, _this3.getCwd()));
    })();
  }

  _resolveFromNodeModules() {
    var _this4 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      var _normalizePattern7 = (0, (_normalizePattern9 || _load_normalizePattern()).normalizePattern)(_this4.pattern);

      const name = _normalizePattern7.name;

      let cwd = _this4.getCwd();
      while (!path.relative(_this4.config.cwd, cwd).startsWith('..')) {
        const loc = path.join(cwd, 'node_modules', name);
        const info = yield _this4.config.getCache(`import-resolver-${loc}`, function () {
          return _this4.resolveLocation(loc);
        });
        if (info) {
          return info;
        }
        cwd = path.resolve(cwd, '../..');
      }
      throw new (_errors || _load_errors()).MessageError(_this4.reporter.lang('importResolveFailed', name, _this4.getCwd()));
    })();
  }

  resolve() {
    if (this.request instanceof ImportPackageRequest && this.request.dependencyTree) {
      return this._resolveFromFixedVersions();
    } else {
      return this._resolveFromNodeModules();
    }
  }
}

class ImportPackageRequest extends (_packageRequest || _load_packageRequest()).default {
  constructor(req, dependencyTree, resolver) {
    super(req, resolver);
    this.import = this.parentRequest instanceof ImportPackageRequest ? this.parentRequest.import : true;
    this.dependencyTree = dependencyTree;
  }

  getRootName() {
    return this.resolver instanceof ImportPackageResolver && this.resolver.rootName || 'root';
  }

  getParentHumanName() {
    return [this.getRootName()].concat(this.parentNames).join(' > ');
  }

  reportResolvedRangeMatch(info, resolved) {
    if (info.version === resolved.version) {
      return;
    }
    this.reporter.warn(this.reporter.lang('importResolvedRangeMatch', resolved.version, resolved.name, info.version, this.getParentHumanName()));
  }

  _findResolvedManifest(info) {
    var _normalizePattern8 = (0, (_normalizePattern9 || _load_normalizePattern()).normalizePattern)(this.pattern);

    const range = _normalizePattern8.range,
          name = _normalizePattern8.name;

    const solvedRange = (_semver || _load_semver()).default.validRange(range) ? info.version : range;
    const resolved = this.resolver.getExactVersionMatch(name, solvedRange, info);
    if (resolved) {
      return resolved;
    }
    invariant(info._remote, 'expected package remote');
    const ref = new (_packageReference || _load_packageReference()).default(this, info, info._remote);
    info._reference = ref;
    return info;
  }

  resolveToExistingVersion(info) {
    const resolved = this._findResolvedManifest(info);
    invariant(resolved, 'should have found a resolved reference');
    const ref = resolved._reference;
    invariant(ref, 'should have a package reference');
    ref.addRequest(this);
    ref.addPattern(this.pattern, resolved);
    ref.addOptional(this.optional);
  }

  findVersionInfo() {
    if (!this.import) {
      this.reporter.verbose(this.reporter.lang('skippingImport', this.pattern, this.getParentHumanName()));
      return super.findVersionInfo();
    }
    const resolver = new ImportResolver(this, this.pattern);
    return resolver.resolve().catch(() => {
      this.import = false;
      this.reporter.warn(this.reporter.lang('importFailed', this.pattern, this.getParentHumanName()));
      return super.findVersionInfo();
    });
  }
}

class ImportPackageResolver extends (_packageResolver || _load_packageResolver()).default {
  constructor(config, lockfile) {
    super(config, lockfile);
    this.next = [];
    this.rootName = 'root';
  }

  find(req) {
    this.next.push(req);
    return Promise.resolve();
  }

  findOne(req) {
    var _this5 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      if (_this5.activity) {
        _this5.activity.tick(req.pattern);
      }
      const request = new ImportPackageRequest(req, _this5.dependencyTree, _this5);
      yield request.find({ fresh: false });
    })();
  }

  findAll(deps) {
    var _this6 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield Promise.all(deps.map(function (dep) {
        return _this6.findOne(dep);
      }));
      deps = _this6.next;
      _this6.next = [];
      if (!deps.length) {
        // all required package versions have been discovered, so now packages that
        // resolved to existing versions can be resolved to their best available version
        _this6.resolvePackagesWithExistingVersions();
        return;
      }
      yield _this6.findAll(deps);
    })();
  }

  resetOptional() {
    for (const pattern in this.patterns) {
      const ref = this.patterns[pattern]._reference;
      invariant(ref, 'expected reference');
      ref.optional = null;
      for (var _iterator = ref.requests, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref = _i.value;
        }

        const req = _ref;

        ref.addOptional(req.optional);
      }
    }
  }

  init(deps, { isFlat, isFrozen, workspaceLayout } = { isFlat: false, isFrozen: false, workspaceLayout: undefined }) {
    var _this7 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      _this7.flat = Boolean(isFlat);
      const activity = _this7.activity = _this7.reporter.activity();
      yield _this7.findAll(deps);
      _this7.resetOptional();
      activity.end();
      _this7.activity = null;
    })();
  }
}

class Import extends (_install || _load_install()).Install {
  constructor(flags, config, reporter, lockfile) {
    super(flags, config, reporter, lockfile);
    this.resolver = new ImportPackageResolver(this.config, this.lockfile);
    this.linker = new (_packageLinker || _load_packageLinker()).default(config, this.resolver);
  }
  createLogicalDependencyTree(packageJson, packageLock) {
    invariant(packageJson, 'package.json should exist');
    invariant(packageLock, 'package-lock.json should exist');
    invariant(this.resolver instanceof ImportPackageResolver, 'resolver should be an ImportPackageResolver');
    try {
      this.resolver.dependencyTree = new (_logicalDependencyTree || _load_logicalDependencyTree()).LogicalDependencyTree(packageJson, packageLock);
    } catch (e) {
      throw new (_errors || _load_errors()).MessageError(this.reporter.lang('importSourceFilesCorrupted'));
    }
  }
  getExternalLockfileContents() {
    var _this8 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      try {
        var _ref2 = yield Promise.all([(_fs || _load_fs()).readFile(path.join(_this8.config.cwd, (_constants || _load_constants()).NODE_PACKAGE_JSON)), (_fs || _load_fs()).readFile(path.join(_this8.config.cwd, (_constants || _load_constants()).NPM_LOCK_FILENAME))]);

        const packageJson = _ref2[0],
              packageLock = _ref2[1];

        return { packageJson, packageLock };
      } catch (e) {
        return { packageJson: null, packageLock: null };
      }
    })();
  }
  init() {
    var _this9 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      if (yield (_fs || _load_fs()).exists(path.join(_this9.config.cwd, (_constants || _load_constants()).LOCKFILE_FILENAME))) {
        throw new (_errors || _load_errors()).MessageError(_this9.reporter.lang('lockfileExists'));
      }

      var _ref3 = yield _this9.getExternalLockfileContents();

      const packageJson = _ref3.packageJson,
            packageLock = _ref3.packageLock;

      const importSource = packageJson && packageLock && (_semver || _load_semver()).default.satisfies(nodeVersion, '>=5.0.0') ? 'package-lock.json' : 'node_modules';
      if (importSource === 'package-lock.json') {
        _this9.reporter.info(_this9.reporter.lang('importPackageLock'));
        _this9.createLogicalDependencyTree(packageJson, packageLock);
      }
      if (importSource === 'node_modules') {
        _this9.reporter.info(_this9.reporter.lang('importNodeModules'));
        yield (0, (_check || _load_check()).verifyTreeCheck)(_this9.config, _this9.reporter, {}, []);
      }

      var _ref4 = yield _this9.fetchRequestFromCwd();

      const requests = _ref4.requests,
            patterns = _ref4.patterns,
            manifest = _ref4.manifest;

      if (manifest.name && _this9.resolver instanceof ImportPackageResolver) {
        _this9.resolver.rootName = manifest.name;
      }
      yield _this9.resolver.init(requests, { isFlat: _this9.flags.flat, isFrozen: _this9.flags.frozenLockfile });
      const manifests = yield (_packageFetcher || _load_packageFetcher()).fetch(_this9.resolver.getManifests(), _this9.config);
      _this9.resolver.updateManifests(manifests);
      yield (_packageCompatibility || _load_packageCompatibility()).check(_this9.resolver.getManifests(), _this9.config, _this9.flags.ignoreEngines);
      yield _this9.linker.resolvePeerModules();
      yield _this9.saveLockfileAndIntegrity(patterns);
      return patterns;
    })();
  }
}

exports.Import = Import;
function setFlags(commander) {
  commander.description('Generates yarn.lock from an npm package-lock.json file or an existing npm-installed node_modules folder.');
}

function hasWrapper(commander, args) {
  return true;
}
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _cache;

function _load_cache() {
  return _cache = require('../../cli/commands/cache.js');
}

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _registryResolver;

function _load_registryResolver() {
  return _registryResolver = _interopRequireDefault(require('./registry-resolver.js'));
}

var _npmRegistry;

function _load_npmRegistry() {
  return _npmRegistry = _interopRequireDefault(require('../../registries/npm-registry.js'));
}

var _map;

function _load_map() {
  return _map = _interopRequireDefault(require('../../util/map.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _constants;

function _load_constants() {
  return _constants = require('../../constants.js');
}

var _packageNameUtils;

function _load_packageNameUtils() {
  return _packageNameUtils = require('../../util/package-name-utils.js');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const inquirer = require('inquirer');
const tty = require('tty');
const path = require('path');
const semver = require('semver');
const ssri = require('ssri');

const NPM_REGISTRY_ID = 'npm';

class NpmResolver extends (_registryResolver || _load_registryResolver()).default {

  static findVersionInRegistryResponse(config, name, range, body, request) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      if (body.versions && Object.keys(body.versions).length === 0) {
        throw new (_errors || _load_errors()).MessageError(config.reporter.lang('registryNoVersions', body.name));
      }

      if (!body['dist-tags'] || !body.versions) {
        throw new (_errors || _load_errors()).MessageError(config.reporter.lang('malformedRegistryResponse', name));
      }

      if (range in body['dist-tags']) {
        range = body['dist-tags'][range];
      }

      // If the latest tag in the registry satisfies the requested range, then use that.
      // Otherwise we will fall back to semver maxSatisfying.
      // This mimics logic in NPM. See issue #3560
      const latestVersion = body['dist-tags'] ? body['dist-tags'].latest : undefined;
      if (latestVersion && semver.satisfies(latestVersion, range)) {
        return body.versions[latestVersion];
      }

      const satisfied = yield config.resolveConstraints(Object.keys(body.versions), range);
      if (satisfied) {
        return body.versions[satisfied];
      } else if (request && !config.nonInteractive) {
        if (request.resolver && request.resolver.activity) {
          request.resolver.activity.end();
        }
        config.reporter.log(config.reporter.lang('couldntFindVersionThatMatchesRange', body.name, range));
        let pageSize;
        if (process.stdout instanceof tty.WriteStream) {
          pageSize = process.stdout.rows - 2;
        }
        const response = yield inquirer.prompt([{
          name: 'package',
          type: 'list',
          message: config.reporter.lang('chooseVersionFromList', body.name),
          choices: semver.rsort(Object.keys(body.versions)),
          pageSize
        }]);
        if (response && response.package) {
          return body.versions[response.package];
        }
      }
      throw new (_errors || _load_errors()).MessageError(config.reporter.lang('couldntFindVersionThatMatchesRange', body.name, range));
    })();
  }

  resolveRequest(desiredVersion) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      if (_this.config.offline) {
        const res = yield _this.resolveRequestOffline();
        if (res != null) {
          return res;
        }
      }

      const escapedName = (_npmRegistry || _load_npmRegistry()).default.escapeName(_this.name);
      const desiredRange = desiredVersion || _this.range;
      const body = yield _this.config.registries.npm.request(escapedName);

      if (body) {
        return NpmResolver.findVersionInRegistryResponse(_this.config, escapedName, desiredRange, body, _this.request);
      } else {
        return null;
      }
    })();
  }

  resolveRequestOffline() {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const packageDirs = yield _this2.config.getCache('cachedPackages', function () {
        return (0, (_cache || _load_cache()).getCachedPackagesDirs)(_this2.config, _this2.config.cacheFolder);
      });

      const versions = (0, (_map || _load_map()).default)();

      for (var _iterator = packageDirs, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref = _i.value;
        }

        const dir = _ref;

        // check if folder contains the registry prefix
        if (dir.indexOf(`${NPM_REGISTRY_ID}-`) === -1) {
          continue;
        }

        // read manifest and validate correct name
        const pkg = yield _this2.config.readManifest(dir, NPM_REGISTRY_ID);
        if (pkg.name !== _this2.name) {
          continue;
        }

        // read package metadata
        const metadata = yield _this2.config.readPackageMetadata(dir);
        if (!metadata.remote) {
          continue; // old yarn metadata
        }

        versions[pkg.version] = Object.assign({}, pkg, {
          _remote: metadata.remote
        });
      }

      const satisfied = yield _this2.config.resolveConstraints(Object.keys(versions), _this2.range);
      if (satisfied) {
        return versions[satisfied];
      } else if (!_this2.config.preferOffline) {
        throw new (_errors || _load_errors()).MessageError(_this2.reporter.lang('couldntFindPackageInCache', _this2.name, _this2.range, Object.keys(versions).join(', ')));
      } else {
        return null;
      }
    })();
  }

  cleanRegistry(url) {
    if (this.config.getOption('registry') === (_constants || _load_constants()).YARN_REGISTRY) {
      return url.replace((_constants || _load_constants()).NPM_REGISTRY_RE, (_constants || _load_constants()).YARN_REGISTRY);
    } else {
      return url;
    }
  }

  resolve() {
    var _this3 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      // lockfile
      const shrunk = _this3.request.getLocked('tarball');
      if (shrunk) {
        if (_this3.config.packBuiltPackages && shrunk.prebuiltVariants && shrunk._remote) {
          const prebuiltVariants = shrunk.prebuiltVariants;
          const prebuiltName = (0, (_packageNameUtils || _load_packageNameUtils()).getPlatformSpecificPackageFilename)(shrunk);
          const offlineMirrorPath = _this3.config.getOfflineMirrorPath();
          if (prebuiltVariants[prebuiltName] && offlineMirrorPath) {
            const filename = path.join(offlineMirrorPath, 'prebuilt', prebuiltName + '.tgz');
            const _remote = shrunk._remote;

            if (_remote && (yield (_fs || _load_fs()).exists(filename))) {
              _remote.reference = `file:${filename}`;
              _remote.hash = prebuiltVariants[prebuiltName];
              _remote.integrity = ssri.fromHex(_remote.hash, 'sha1').toString();
            }
          }
        }
      }
      if (shrunk && shrunk._remote && (shrunk._remote.integrity || _this3.config.offline || !_this3.config.autoAddIntegrity)) {
        // if the integrity field does not exist, we're not network-restricted, and the
        // migration hasn't been disabled, it needs to be created
        return shrunk;
      }

      const desiredVersion = shrunk && shrunk.version ? shrunk.version : null;
      const info = yield _this3.resolveRequest(desiredVersion);
      if (info == null) {
        throw new (_errors || _load_errors()).MessageError(_this3.reporter.lang('packageNotFoundRegistry', _this3.name, NPM_REGISTRY_ID));
      }

      const deprecated = info.deprecated,
            dist = info.dist;

      if (shrunk && shrunk._remote) {
        shrunk._remote.integrity = dist && dist.integrity ? ssri.parse(dist.integrity) : ssri.fromHex(dist && dist.shasum ? dist.shasum : '', 'sha1');
        return shrunk;
      }

      if (typeof deprecated === 'string') {
        let human = `${info.name}@${info.version}`;
        const parentNames = _this3.request.parentNames;
        if (parentNames.length) {
          human = parentNames.concat(human).join(' > ');
        }
        _this3.reporter.warn(`${human}: ${deprecated}`);
      }

      if (dist != null && dist.tarball) {
        info._remote = {
          resolved: `${_this3.cleanRegistry(dist.tarball)}#${dist.shasum}`,
          type: 'tarball',
          reference: _this3.cleanRegistry(dist.tarball),
          hash: dist.shasum,
          integrity: dist.integrity ? ssri.parse(dist.integrity) : ssri.fromHex(dist.shasum, 'sha1'),
          registry: NPM_REGISTRY_ID,
          packageName: info.name
        };
      }

      info._uid = info.version;

      return info;
    })();
  }
}
exports.default = NpmResolver;
NpmResolver.registry = NPM_REGISTRY_ID;
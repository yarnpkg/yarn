'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _errors;

function _load_errors() {
  return _errors = require('../errors.js');
}

var _baseFetcher;

function _load_baseFetcher() {
  return _baseFetcher = _interopRequireDefault(require('./base-fetcher.js'));
}

var _git;

function _load_git() {
  return _git = _interopRequireDefault(require('../util/git.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../util/fs.js'));
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('../constants.js'));
}

var _crypto;

function _load_crypto() {
  return _crypto = _interopRequireWildcard(require('../util/crypto.js'));
}

var _install;

function _load_install() {
  return _install = require('../cli/commands/install.js');
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../lockfile'));
}

var _config;

function _load_config() {
  return _config = _interopRequireDefault(require('../config.js'));
}

var _pack;

function _load_pack() {
  return _pack = require('../cli/commands/pack.js');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const tarFs = require('tar-fs');
const url = require('url');
const path = require('path');
const fs = require('fs');

const invariant = require('invariant');

const PACKED_FLAG = '1';

class GitFetcher extends (_baseFetcher || _load_baseFetcher()).default {
  setupMirrorFromCache() {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const tarballMirrorPath = _this.getTarballMirrorPath();
      const tarballCachePath = _this.getTarballCachePath();

      if (tarballMirrorPath == null) {
        return;
      }

      if (!(yield (_fs || _load_fs()).exists(tarballMirrorPath)) && (yield (_fs || _load_fs()).exists(tarballCachePath))) {
        // The tarball doesn't exists in the offline cache but does in the cache; we import it to the mirror
        yield (_fs || _load_fs()).mkdirp(path.dirname(tarballMirrorPath));
        yield (_fs || _load_fs()).copy(tarballCachePath, tarballMirrorPath, _this.reporter);
      }
    })();
  }

  getTarballMirrorPath({ withCommit = true } = {}) {
    var _url$parse = url.parse(this.reference);

    const pathname = _url$parse.pathname;


    if (pathname == null) {
      return null;
    }

    const hash = this.hash;

    let packageFilename = withCommit && hash ? `${path.basename(pathname)}-${hash}` : `${path.basename(pathname)}`;

    if (packageFilename.startsWith(':')) {
      packageFilename = packageFilename.substr(1);
    }

    return this.config.getOfflineMirrorPath(packageFilename);
  }

  getTarballCachePath() {
    return path.join(this.dest, (_constants || _load_constants()).TARBALL_FILENAME);
  }

  getLocalPaths(override) {
    const paths = [override ? path.resolve(this.config.cwd, override) : null, this.getTarballMirrorPath(), this.getTarballMirrorPath({ withCommit: false }), this.getTarballCachePath()];
    // $FlowFixMe: https://github.com/facebook/flow/issues/1414
    return paths.filter(path => path != null);
  }

  fetchFromLocal(override) {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const tarPaths = _this2.getLocalPaths(override);
      const stream = yield (_fs || _load_fs()).readFirstAvailableStream(tarPaths);

      return new Promise(function (resolve, reject) {
        if (!stream) {
          reject(new (_errors || _load_errors()).MessageError(_this2.reporter.lang('tarballNotInNetworkOrCache', _this2.reference, tarPaths)));
          return;
        }
        invariant(stream, 'cachedStream should be available at this point');
        // $FlowFixMe - This is available https://nodejs.org/api/fs.html#fs_readstream_path
        const tarballPath = stream.path;

        const untarStream = _this2._createUntarStream(_this2.dest);

        const hashStream = new (_crypto || _load_crypto()).HashStream();
        stream.pipe(hashStream).pipe(untarStream).on('finish', function () {
          const expectHash = _this2.hash;
          invariant(expectHash, 'Commit hash required');

          const actualHash = hashStream.getHash();

          // This condition is disabled because "expectHash" actually is the commit hash
          // This is a design issue that we'll need to fix (https://github.com/yarnpkg/yarn/pull/3449)
          if (true || !expectHash || expectHash === actualHash) {
            resolve({
              hash: expectHash
            });
          } else {
            reject(new (_errors || _load_errors()).SecurityError(_this2.config.reporter.lang('fetchBadHashWithPath', _this2.packageName, _this2.remote.reference, expectHash, actualHash)));
          }
        }).on('error', function (err) {
          reject(new (_errors || _load_errors()).MessageError(this.reporter.lang('fetchErrorCorrupt', err.message, tarballPath)));
        });
      });
    })();
  }

  hasPrepareScript(git) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const manifestFile = yield git.getFile('package.json');

      if (manifestFile) {
        const scripts = JSON.parse(manifestFile).scripts;
        const hasPrepareScript = Boolean(scripts && scripts.prepare);
        return hasPrepareScript;
      }

      return false;
    })();
  }

  fetchFromExternal() {
    var _this3 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const hash = _this3.hash;
      invariant(hash, 'Commit hash required');

      const gitUrl = (_git || _load_git()).default.npmUrlToGitUrl(_this3.reference);
      const git = new (_git || _load_git()).default(_this3.config, gitUrl, hash);
      yield git.init();

      if (yield _this3.hasPrepareScript(git)) {
        yield _this3.fetchFromInstallAndPack(git);
      } else {
        yield _this3.fetchFromGitArchive(git);
      }

      return {
        hash
      };
    })();
  }

  fetchFromInstallAndPack(git) {
    var _this4 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const prepareDirectory = _this4.config.getTemp(`${(_crypto || _load_crypto()).hash(git.gitUrl.repository)}.${git.hash}.prepare`);
      yield (_fs || _load_fs()).unlink(prepareDirectory);

      yield git.clone(prepareDirectory);

      var _ref = yield Promise.all([(_config || _load_config()).default.create({
        binLinks: true,
        cwd: prepareDirectory,
        disablePrepublish: true
      }, _this4.reporter), (_lockfile || _load_lockfile()).default.fromDirectory(prepareDirectory, _this4.reporter)]);

      const prepareConfig = _ref[0],
            prepareLockFile = _ref[1];

      yield (0, (_install || _load_install()).install)(prepareConfig, _this4.reporter, {}, prepareLockFile);

      const tarballMirrorPath = _this4.getTarballMirrorPath();
      const tarballCachePath = _this4.getTarballCachePath();

      if (tarballMirrorPath) {
        yield _this4._packToTarball(prepareConfig, tarballMirrorPath);
      }
      if (tarballCachePath) {
        yield _this4._packToTarball(prepareConfig, tarballCachePath);
      }

      yield _this4._packToDirectory(prepareConfig, _this4.dest);

      yield (_fs || _load_fs()).unlink(prepareDirectory);
    })();
  }

  _packToTarball(config, path) {
    var _this5 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const tarballStream = yield _this5._createTarballStream(config);
      yield new Promise(function (resolve, reject) {
        const writeStream = fs.createWriteStream(path);
        tarballStream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('end', resolve);
        writeStream.on('open', function () {
          tarballStream.pipe(writeStream);
        });
        writeStream.once('finish', resolve);
      });
    })();
  }

  _packToDirectory(config, dest) {
    var _this6 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const tarballStream = yield _this6._createTarballStream(config);
      yield new Promise(function (resolve, reject) {
        const untarStream = _this6._createUntarStream(dest);
        tarballStream.on('error', reject);
        untarStream.on('error', reject);
        untarStream.on('end', resolve);
        untarStream.once('finish', resolve);
        tarballStream.pipe(untarStream);
      });
    })();
  }

  _createTarballStream(config) {
    let savedPackedHeader = false;
    return (0, (_pack || _load_pack()).packTarball)(config, {
      mapHeader(header) {
        if (!savedPackedHeader) {
          savedPackedHeader = true;
          header.pax = header.pax || {};
          // add a custom data on the first header
          // in order to distinguish a tar from "git archive" and a tar from "pack" command
          header.pax.packed = PACKED_FLAG;
        }
        return header;
      }
    });
  }

  _createUntarStream(dest) {
    const PREFIX = 'package/';
    let isPackedTarball = undefined;
    return tarFs.extract(dest, {
      dmode: 0o555, // all dirs should be readable
      fmode: 0o444, // all files should be readable
      chown: false, // don't chown. just leave as it is
      map: header => {
        if (isPackedTarball === undefined) {
          isPackedTarball = header.pax && header.pax.packed === PACKED_FLAG;
        }
        if (isPackedTarball) {
          header.name = header.name.substr(PREFIX.length);
        }
      }
    });
  }

  fetchFromGitArchive(git) {
    var _this7 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield git.clone(_this7.dest);
      const tarballMirrorPath = _this7.getTarballMirrorPath();
      const tarballCachePath = _this7.getTarballCachePath();

      if (tarballMirrorPath) {
        yield git.archive(tarballMirrorPath);
      }

      if (tarballCachePath) {
        yield git.archive(tarballCachePath);
      }
    })();
  }

  _fetch() {
    return this.fetchFromLocal().catch(err => this.fetchFromExternal());
  }
}
exports.default = GitFetcher;
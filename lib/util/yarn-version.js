'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getInstallationMethod = exports.version = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let getInstallationMethod = exports.getInstallationMethod = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
    let installationMethod = originalInstallationMethod;

    // If there's a package.json in the parent directory, it could have an
    // override for the installation method, so we should prefer that over
    // whatever was originally in Yarn's package.json. This is the case with
    // systems such as Homebrew, which take the tarball and modify the
    // installation method so we're aware of the fact that Yarn was installed via
    // Homebrew (so things like update notifications can point out the correct
    // command to upgrade).
    try {
      const manifestPath = (_path || _load_path()).default.join(__dirname, '..', 'package.json');
      if ((_fs2 || _load_fs2()).default.existsSync(manifestPath)) {
        // non-async version is deprecated
        const manifest = yield (0, (_fs || _load_fs()).readJson)(manifestPath);
        if (manifest.installationMethod) {
          installationMethod = manifest.installationMethod;
        }
      }
    } catch (e) {
      // Ignore any errors; this is not critical functionality.
    }
    return installationMethod;
  });

  return function getInstallationMethod() {
    return _ref.apply(this, arguments);
  };
})();

var _fs;

function _load_fs() {
  return _fs = require('./fs');
}

var _fs2;

function _load_fs2() {
  return _fs2 = _interopRequireDefault(require('fs'));
}

var _path;

function _load_path() {
  return _path = _interopRequireDefault(require('path'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// This will be bundled directly in the .js file for production builds
var _require = require('../../package.json'); /**
                                               * Determines the current version of Yarn itself.
                                               * 
                                               */

const version = _require.version,
      originalInstallationMethod = _require.installationMethod;
exports.version = version;
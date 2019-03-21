'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let makePortableProxyScriptUnix = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (source, destination, options) {
    const environment = options.extraEnvironment ? Array.from(options.extraEnvironment.entries()).map(function ([key, value]) {
      return `${key}="${value}"`;
    }).join(' ') + ' ' : '';

    const prependedArguments = options.prependArguments ? ' ' + options.prependArguments.map(function (arg) {
      return `"${arg}"`;
    }).join(' ') : '';
    const appendedArguments = options.appendArguments ? ' ' + options.appendArguments.map(function (arg) {
      return `"${arg}"`;
    }).join(' ') : '';

    const filePath = `${destination}/${options.proxyBasename || path.basename(source)}`;

    // Unless impossible we want to preserve any symlinks used to call us when forwarding the call to the binary (so we
    // cannot use realpath or transform relative paths into absolute ones), but we also need to tell the sh interpreter
    // that the symlink should be resolved relative to the script directory (hence dirname "$0" at runtime).
    const sourcePath = path.isAbsolute(source) ? source : `$(dirname "$0")/../${source}`;

    yield (_fs || _load_fs()).mkdirp(destination);

    if (process.platform === 'win32') {
      yield (_fs || _load_fs()).writeFile(filePath + '.cmd', `@${environment}"${sourcePath}" ${prependedArguments} ${appendedArguments} %*\r\n`);
    } else {
      yield (_fs || _load_fs()).writeFile(filePath, `#!/bin/sh\n\n${environment}exec "${sourcePath}"${prependedArguments} "$@"${appendedArguments}\n`);
      yield (_fs || _load_fs()).chmod(filePath, 0o755);
    }
  });

  return function makePortableProxyScriptUnix(_x, _x2, _x3) {
    return _ref.apply(this, arguments);
  };
})();

exports.makePortableProxyScript = makePortableProxyScript;

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('./fs.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const path = require('path');

function makePortableProxyScript(source, destination,
// $FlowFixMe Flow doesn't support exact types with empty default values
options = {}) {
  return makePortableProxyScriptUnix(source, destination, options);
}
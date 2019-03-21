'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FILE_PROTOCOL_PREFIX = undefined;

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

var _uuid;

function _load_uuid() {
  return _uuid = _interopRequireDefault(require('uuid'));
}

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _exoticResolver;

function _load_exoticResolver() {
  return _exoticResolver = _interopRequireDefault(require('./exotic-resolver.js'));
}

var _misc;

function _load_misc() {
  return _misc = _interopRequireWildcard(require('../../util/misc.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const FILE_PROTOCOL_PREFIX = exports.FILE_PROTOCOL_PREFIX = 'file:';

class FileResolver extends (_exoticResolver || _load_exoticResolver()).default {
  constructor(request, fragment) {
    super(request, fragment);
    this.loc = (_misc || _load_misc()).removePrefix(fragment, FILE_PROTOCOL_PREFIX);
  }

  static isVersion(pattern) {
    return super.isVersion.call(this, pattern) || this.prefixMatcher.test(pattern) || (_path || _load_path()).default.isAbsolute(pattern);
  }

  resolve() {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      let loc = _this.loc;
      if (!(_path || _load_path()).default.isAbsolute(loc)) {
        loc = (_path || _load_path()).default.resolve(_this.config.lockfileFolder, loc);
      }

      if (_this.config.linkFileDependencies) {
        const registry = 'npm';
        const manifest = { _uid: '', name: '', version: '0.0.0', _registry: registry };
        manifest._remote = {
          type: 'link',
          registry,
          hash: null,
          reference: loc
        };
        manifest._uid = manifest.version;
        return manifest;
      }
      if (!(yield (_fs || _load_fs()).exists(loc))) {
        throw new (_errors || _load_errors()).MessageError(_this.reporter.lang('doesntExist', loc, _this.pattern.split('@')[0]));
      }

      const manifest = yield (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
        try {
          return yield _this.config.readManifest(loc, _this.registry);
        } catch (e) {
          if (e.code === 'ENOENT') {
            return {
              // This is just the default, it can be overridden with key of dependencies
              name: (_path || _load_path()).default.dirname(loc),
              version: '0.0.0',
              _uid: '0.0.0',
              _registry: 'npm'
            };
          }

          throw e;
        }
      })();
      const registry = manifest._registry;
      (0, (_invariant || _load_invariant()).default)(registry, 'expected registry');

      manifest._remote = {
        type: 'copy',
        registry,
        hash: `${(_uuid || _load_uuid()).default.v4()}-${new Date().getTime()}`,
        reference: loc
      };

      manifest._uid = manifest.version;

      return manifest;
    })();
  }
}
exports.default = FileResolver;
FileResolver.protocol = 'file';
FileResolver.prefixMatcher = /^\.{1,2}\//;
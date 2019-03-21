'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

let run = exports.run = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    const builderName = args[0],
          rest = args.slice(1);


    if (!builderName) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('invalidPackageName'));
    }

    var _coerceCreatePackageN = coerceCreatePackageName(builderName);

    const packageName = _coerceCreatePackageN.fullName,
          commandName = _coerceCreatePackageN.name;

    yield (0, (_global || _load_global()).run)(config, reporter, {}, ['add', packageName]);

    const binFolder = yield (0, (_global || _load_global()).getBinFolder)(config, {});
    const command = path.resolve(binFolder, commandName);

    yield (_child || _load_child()).spawn(command, rest, { stdio: `inherit`, shell: true });
  });

  return function run(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;
exports.parsePackageName = parsePackageName;
exports.coerceCreatePackageName = coerceCreatePackageName;

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _child;

function _load_child() {
  return _child = _interopRequireWildcard(require('../../util/child.js'));
}

var _global;

function _load_global() {
  return _global = require('./global.js');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const path = require('path');

function setFlags(commander) {
  commander.description('Creates new projects from any create-* starter kits.');
}

function hasWrapper(commander, args) {
  return true;
}

function parsePackageName(str) {
  if (str.charAt(0) === '/') {
    throw new Error(`Name should not start with "/", got "${str}"`);
  }
  if (str.charAt(0) === '.') {
    throw new Error(`Name should not start with ".", got "${str}"`);
  }
  const parts = str.split('/');
  const isScoped = str.charAt(0) === '@';
  if (isScoped && parts[0] === '@') {
    throw new Error(`Scope should not be empty, got "${str}"`);
  }
  const scope = isScoped ? parts[0] : '';
  const name = parts[isScoped ? 1 : 0] || '';
  const path = parts.slice(isScoped ? 2 : 1).join('/');
  const fullName = [scope, name].filter(Boolean).join('/');
  const full = [scope, name, path].filter(Boolean).join('/');

  return { fullName, name, scope, path, full };
}

function coerceCreatePackageName(str) {
  const pkgNameObj = parsePackageName(str);
  const coercedName = pkgNameObj.name !== '' ? `create-${pkgNameObj.name}` : `create`;
  const coercedPkgNameObj = (0, (_extends2 || _load_extends()).default)({}, pkgNameObj, {
    name: coercedName,
    fullName: [pkgNameObj.scope, coercedName].filter(Boolean).join('/'),
    full: [pkgNameObj.scope, coercedName, pkgNameObj.path].filter(Boolean).join('/')
  });
  return coercedPkgNameObj;
}
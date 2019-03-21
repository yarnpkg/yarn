'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let run = exports.run = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    yield config.registries.yarn.saveHomeConfig({
      username: undefined,
      email: undefined
    });

    reporter.success(reporter.lang('clearedCredentials'));
  });

  return function run(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function setFlags(commander) {
  commander.description('Clears registry username and email.');
}

function hasWrapper(commander, args) {
  return true;
}
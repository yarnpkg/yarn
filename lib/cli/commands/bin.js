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
    const binFolder = path.join(config.cwd, config.registryFolders[0], '.bin');
    if (args.length === 0) {
      reporter.log(binFolder, { force: true });
    } else {
      const binEntries = yield (0, (_run || _load_run()).getBinEntries)(config);

      const binName = args[0];
      const binPath = binEntries.get(binName);

      if (binPath) {
        reporter.log(binPath, { force: true });
      } else {
        reporter.error(reporter.lang('packageBinaryNotFound', binName));
      }
    }
  });

  return function run(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

exports.hasWrapper = hasWrapper;
exports.setFlags = setFlags;

var _run;

function _load_run() {
  return _run = require('./run.js');
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const path = require('path');

function hasWrapper(commander) {
  return false;
}

function setFlags(commander) {
  commander.description('Displays the location of the yarn bin folder.');
}
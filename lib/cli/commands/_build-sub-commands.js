'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

exports.default = function (rootCommandName, subCommands, usage = []) {
  let run = (() => {
    var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
      const subName = (0, (_misc || _load_misc()).camelCase)(args.shift() || '');
      if (subName && subCommands[subName]) {
        const command = subCommands[subName];
        const res = yield command(config, reporter, flags, args);
        if (res !== false) {
          return Promise.resolve();
        }
      }

      if (usage && usage.length) {
        reporter.error(`${reporter.lang('usage')}:`);
        for (var _iterator = usage, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
          var _ref2;

          if (_isArray) {
            if (_i >= _iterator.length) break;
            _ref2 = _iterator[_i++];
          } else {
            _i = _iterator.next();
            if (_i.done) break;
            _ref2 = _i.value;
          }

          const msg = _ref2;

          reporter.error(`yarn ${rootCommandName} ${msg}`);
        }
      }
      return Promise.reject(new (_errors || _load_errors()).MessageError(reporter.lang('invalidCommand', subCommandNames.join(', '))));
    });

    return function run(_x, _x2, _x3, _x4) {
      return _ref.apply(this, arguments);
    };
  })();

  const subCommandNames = Object.keys(subCommands).map((_misc || _load_misc()).hyphenate);

  function setFlags(commander) {
    commander.usage(`${rootCommandName} [${subCommandNames.join('|')}] [flags]`);
  }

  function hasWrapper(commander, args) {
    return true;
  }

  const examples = usage.map(cmd => {
    return `${rootCommandName} ${cmd}`;
  });

  return { run, setFlags, hasWrapper, examples };
};

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _misc;

function _load_misc() {
  return _misc = require('../../util/misc.js');
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hasWrapper = hasWrapper;
exports.setFlags = setFlags;
exports.run = run;

var _index;

function _load_index() {
  return _index = _interopRequireDefault(require('./index.js'));
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('../../constants.js'));
}

var _misc;

function _load_misc() {
  return _misc = require('../../util/misc.js');
}

var _aliases;

function _load_aliases() {
  return _aliases = _interopRequireDefault(require('../aliases'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const chalk = require('chalk');

function hasWrapper(flags, args) {
  return false;
}

function setFlags(commander) {
  commander.description('Displays help information.');
}

function run(config, reporter, commander, args) {
  if (args.length) {
    const commandName = args.shift();
    if (Object.prototype.hasOwnProperty.call((_index || _load_index()).default, commandName)) {
      const command = (_index || _load_index()).default[commandName];
      if (command) {
        command.setFlags(commander);
        const examples = (command.examples || []).map(example => `    $ yarn ${example}`);
        if (examples.length) {
          commander.on('--help', () => {
            reporter.log(reporter.lang('helpExamples', reporter.rawText(examples.join('\n'))));
          });
        }
        // eslint-disable-next-line yarn-internal/warn-language
        commander.on('--help', () => reporter.log('  ' + command.getDocsInfo + '\n'));
        commander.help();
        return Promise.resolve();
      }
    }
  }

  commander.on('--help', () => {
    const commandsText = [];
    for (var _iterator = Object.keys((_index || _load_index()).default).sort((_misc || _load_misc()).sortAlpha), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref = _i.value;
      }

      const name = _ref;

      if ((_index || _load_index()).default[name].useless || Object.keys((_aliases || _load_aliases()).default).map(key => (_aliases || _load_aliases()).default[key]).indexOf(name) > -1) {
        continue;
      }
      if ((_aliases || _load_aliases()).default[name]) {
        commandsText.push(`    - ${(0, (_misc || _load_misc()).hyphenate)(name)} / ${(_aliases || _load_aliases()).default[name]}`);
      } else {
        commandsText.push(`    - ${(0, (_misc || _load_misc()).hyphenate)(name)}`);
      }
    }
    reporter.log(reporter.lang('helpCommands', reporter.rawText(commandsText.join('\n'))));
    reporter.log(reporter.lang('helpCommandsMore', reporter.rawText(chalk.bold('yarn help COMMAND'))));
    reporter.log(reporter.lang('helpLearnMore', reporter.rawText(chalk.bold((_constants || _load_constants()).YARN_DOCS))));
  });

  commander.options.sort((_misc || _load_misc()).sortOptionsByFlags);

  commander.help();
  return Promise.resolve();
}
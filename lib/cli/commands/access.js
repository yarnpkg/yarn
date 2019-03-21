'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.examples = exports.hasWrapper = exports.run = undefined;
exports.setFlags = setFlags;

var _buildSubCommands2;

function _load_buildSubCommands() {
  return _buildSubCommands2 = _interopRequireDefault(require('./_build-sub-commands.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const notYetImplemented = () => Promise.reject(new Error('This command is not implemented yet.'));

function setFlags(commander) {
  commander.description('Has not been implemented yet');
}

var _buildSubCommands = (0, (_buildSubCommands2 || _load_buildSubCommands()).default)('access', {
  public: notYetImplemented,
  restricted: notYetImplemented,
  grant: notYetImplemented,
  revoke: notYetImplemented,
  lsPackages: notYetImplemented,
  lsCollaborators: notYetImplemented,
  edit: notYetImplemented
}, ['WARNING: This command yet to be implemented.', 'public [<package>]', 'restricted [<package>]', 'grant <read-only|read-write> <scope:team> [<package>]', 'revoke <scope:team> [<package>]', 'ls-packages [<user>|<scope>|<scope:team>]', 'ls-collaborators [<package> [<user>]]', 'edit [<package>]']);

const run = _buildSubCommands.run,
      hasWrapper = _buildSubCommands.hasWrapper,
      examples = _buildSubCommands.examples;
exports.run = run;
exports.hasWrapper = hasWrapper;
exports.examples = examples;